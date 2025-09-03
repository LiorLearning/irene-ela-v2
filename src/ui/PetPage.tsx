import React, { useState, useEffect } from 'react';
import { useCoins } from './coinSystem';

type Props = {
  onBack?: () => void;
};

type ActionStatus = 'happy' | 'sad' | 'neutral';

interface ActionButton {
  id: string;
  icon: string;
  status: ActionStatus;
  label: string;
}

export function PetPage({ onBack }: Props): JSX.Element {
  // Use shared coin system
  const { coins, spendCoins, hasEnoughCoins } = useCoins();
  
  // Pet care system
  const [careLevel, setCareLevel] = useState(0); // 0 to 6 (number of actions performed)
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [previousCoins, setPreviousCoins] = useState(coins);
  const [showPetShop, setShowPetShop] = useState(false);
  const [ownedPets, setOwnedPets] = useState<string[]>(['dog']); // Start with dog
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [lastSpokenMessage, setLastSpokenMessage] = useState('');
  
  // Pet action states
  const [actionStates, setActionStates] = useState<ActionButton[]>([
    { id: 'water', icon: '🍪', status: 'sad', label: 'Food' },
    { id: 'more', icon: '🐾', status: 'neutral', label: 'More' }
  ]);

  const handleActionClick = (actionId: string) => {
    // Don't deduct coins for "More" action - always open pet shop
    if (actionId === 'more') {
      // Stop any current audio when opening pet shop
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
      setShowPetShop(true);
      return;
    }

    // Check if player has enough coins for feeding actions
    if (!hasEnoughCoins(10)) {
      alert("Not enough coins! You need 10 coins to perform this action.");
      return;
    }

    // Play feeding sound
    playFeedingSound();

    // Deduct coins and increase care level
    spendCoins(10);
    setCareLevel(prev => Math.min(prev + 1, 6)); // Max 6 actions

    // Trigger heart animation
    setShowHeartAnimation(true);
    setTimeout(() => setShowHeartAnimation(false), 1000);

    // Update action status to happy
    setActionStates(prev => prev.map(action => 
      action.id === actionId 
        ? { ...action, status: 'happy' }
        : action
    ));
  };

  const getStatusEmoji = (status: ActionStatus) => {
    switch (status) {
      // case 'happy': return '😊';
      // case 'sad': return '😢';
      case 'neutral': return '';
      default: return '';
    }
  };

  // Sound effect functions
  const playFeedingSound = () => {
    try {
      // Create a pleasant "nom nom" eating sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create a short, pleasant eating sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Pleasant "crunch" sound frequencies
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.type = 'triangle';
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Audio not supported');
    }
  };

  const playEvolutionSound = () => {
    try {
      // Create a magical "sparkle" evolution sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create multiple tones for a magical effect
      const frequencies = [523, 659, 784, 1047]; // C, E, G, C (major chord)
      
      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.1);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + index * 0.1);
        gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + index * 0.1 + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.1 + 0.8);
        
        oscillator.start(audioContext.currentTime + index * 0.1);
        oscillator.stop(audioContext.currentTime + index * 0.1 + 0.8);
      });
    } catch (error) {
      console.log('Audio not supported');
    }
  };

  const getPetImage = () => {
    // Calculate total coins spent on feeding (10 coins per feeding action)
    const coinsSpentOnFeeding = careLevel * 10;
    
    // Pet images based on coins spent on feeding
    // 0 coins spent: first image, 30+ coins spent: second image, 60+ coins spent: third image
    const currentImage = coinsSpentOnFeeding >= 60 
      ? "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250903_183026_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"
      : coinsSpentOnFeeding >= 30 
        ? "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250903_181415_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"
        : "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250903_180656_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    
    // Check if pet evolved and play sound based on care level changes
    if (previousCoins !== coins) {
      const previousCareLevel = Math.floor((previousCoins === coins ? careLevel - 1 : careLevel));
      const previousCoinsSpent = Math.max(0, previousCareLevel * 10);
      
      // Play sound when crossing evolution thresholds (spending more coins on feeding)
      if ((previousCoinsSpent < 30 && coinsSpentOnFeeding >= 30) || 
          (previousCoinsSpent < 60 && coinsSpentOnFeeding >= 60)) {
        setTimeout(() => playEvolutionSound(), 400); // Delay to sync with animation
      }
      setPreviousCoins(coins);
    }
    
    return currentImage;
  };

  const handlePetPurchase = (petType: string, cost: number) => {
    if (!hasEnoughCoins(cost)) {
      alert(`Not enough coins! You need ${cost} coins to buy this pet.`);
      return;
    }

    if (ownedPets.includes(petType)) {
      alert("You already own this pet!");
      return;
    }

    // Deduct coins and add pet to owned pets
    spendCoins(cost);
    setOwnedPets(prev => [...prev, petType]);
    
    // Play purchase sound (reuse evolution sound for now)
    playEvolutionSound();
    
    alert(`🎉 Congratulations! You bought a ${petType}!`);
  };

  const availablePets = [
    { id: 'frog', emoji: '🐸', name: 'Frog', cost: 60 },
    { id: 'hen', emoji: '🐔', name: 'Hen', cost: 60 }
  ];

  // ElevenLabs Text-to-Speech function
  const speakText = async (text: string) => {
    if (!audioEnabled || text === lastSpokenMessage) return;
    
    try {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      // Clean text for TTS (remove emojis and special characters)
      const cleanText = text.replace(/[🐶🍪🥳😊💖]/g, '').replace(/…/g, '...');
      
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          voice_id: 'EXAVITQu4vr4xnSDxMaL', // Jessica voice (default from your API)
          speed: 1.0
        })
      });

      console.log('TTS Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('TTS Response data received');
        
        // Use the audioUrl from the response (base64 data URL)
        const audio = new Audio(data.audioUrl);
        
        setCurrentAudio(audio);
        setLastSpokenMessage(text);
        
        audio.onended = () => {
          setCurrentAudio(null);
        };
        
        console.log('Playing audio...');
        await audio.play();
      } else {
        console.error('TTS API error:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
      }
    } catch (error) {
      console.error('TTS error:', error);
    }
  };

  const getPetThought = () => {
    // Calculate total coins spent on feeding (10 coins per feeding action)
    const coinsSpentOnFeeding = careLevel * 10;
    
    // Pet thoughts based on coins spent on feeding
    if (coinsSpentOnFeeding === 0) {
      // No coins spent on feeding yet
      if (coins < 10) {
        return "Hi Irene! I'm Robber 🐶… my tummy's rumbling! Can you feed me some cookies?";
      } else {
        return "Hi Irene! I'm Robber 🐶… my tummy's rumbling! Can you feed me some cookies?";
      }
    } else if (coinsSpentOnFeeding < 30) {
      // 10-20 coins spent on feeding (1-2 feedings)
      return "Mmm… yummy! 🍪 More cookies will make me wag my tail even faster!";
    } else if (coinsSpentOnFeeding < 60) {
      // 30-50 coins spent on feeding (3-5 feedings)
      return "Woof woof! I'm growing stronger! 🐶 Keep feeding me - I'm getting bigger!";
    } else {
      // 60+ coins spent on feeding (6+ feedings)
      return "Yippee! 🥳 I feel amazing, Irene! Now… could you get me some friends to play with!";
    }
  };

  // Handle audio playback when message changes
  useEffect(() => {
    const currentMessage = getPetThought();
    
    // Only speak when:
    // 1. Not in pet shop
    // 2. Audio is enabled
    // 3. Message has changed
    // 4. There's no current audio playing
    if (!showPetShop && audioEnabled && currentMessage !== lastSpokenMessage && !currentAudio) {
      const timer = setTimeout(() => {
        speakText(currentMessage);
      }, 500); // Small delay for smooth UX
      
      return () => clearTimeout(timer);
    }
  }, [coins, careLevel, showPetShop, audioEnabled, lastSpokenMessage, currentAudio]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundImage: `url('https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250903_181706_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center -120px',
      backgroundRepeat: 'no-repeat',
      padding: 0,
      fontFamily: 'Quicksand, system-ui, sans-serif',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#4A90E2',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10
          }}
        >
          ↩️
        </button>
      )}

      {/* Top UI - Coins */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
        padding: '12px 24px',
        borderRadius: 25,
        color: '#8B4513',
        fontWeight: 700,
        fontSize: 18,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <span style={{ fontSize: 20 }}>🪙</span>
        <span>{coins} coins</span>
      </div>

      {/* Top UI - Heart only */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 40,
        zIndex: 20
      }}>
        {/* Heart that fills with blood */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          position: 'relative',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <div style={{
            position: 'relative',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Heart outline */}
            <div style={{
              position: 'absolute',
              fontSize: 64,
              color: '#E5E7EB'
            }}>
              🤍
            </div>
            {/* Filled heart (blood) */}
            <div style={{
              position: 'absolute',
              fontSize: 64,
              color: '#DC2626',
              clipPath: `inset(${100 - (careLevel / 6 * 100)}% 0 0 0)`,
              transition: 'clip-path 500ms ease'
            }}>
              ❤️
            </div>
          </div>
        </div>

        {/* Animated hearts moving from pet to main heart */}
        {showHeartAnimation && (
          <>
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              fontSize: 20,
              color: '#DC2626',
              animation: 'heartFlyFromPet1 1200ms ease-out forwards',
              pointerEvents: 'none',
              zIndex: 30
            }}>
              ❤️
            </div>
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              fontSize: 16,
              color: '#DC2626',
              animation: 'heartFlyFromPet2 1200ms ease-out forwards',
              animationDelay: '150ms',
              pointerEvents: 'none',
              zIndex: 30
            }}>
              ❤️
            </div>
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              fontSize: 18,
              color: '#DC2626',
              animation: 'heartFlyFromPet3 1200ms ease-out forwards',
              animationDelay: '300ms',
              pointerEvents: 'none',
              zIndex: 30
            }}>
              ❤️
            </div>
          </>
        )}
      </div>

      {/* Main pet area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        paddingBottom: '10px' // Space for bottom buttons
      }}>
        {/* Pet Thought Bubble - Only show when pet shop is closed */}
        {!showPetShop && (
          <div style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            borderRadius: 20,
            padding: '16px 20px',
            marginBottom: 20,
            border: '2px solid #0ea5e9',
            boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)',
            maxWidth: 400,
            width: '90%'
          }}>
            {/* Speech bubble tail */}
            <div style={{
              position: 'absolute',
              bottom: -10,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '10px solid #0ea5e9'
            }} />
            
            {/* Thought bubble dots */}
            <div style={{
              position: 'absolute',
              bottom: -25,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 4
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#0ea5e9',
                animation: 'thoughtBubble 2s ease-in-out infinite'
              }} />
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#0ea5e9',
                animation: 'thoughtBubble 2s ease-in-out infinite 0.3s'
              }} />
              <div style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: '#0ea5e9',
                animation: 'thoughtBubble 2s ease-in-out infinite 0.6s'
              }} />
            </div>

            <div style={{
              fontSize: 14,
              color: '#0f172a',
              fontWeight: 500,
              lineHeight: 1.4,
              fontFamily: 'Quicksand, system-ui, sans-serif',
              textAlign: 'center'
            }}>
              {getPetThought()}
            </div>
          </div>
        )}

        {/* Pet (Custom Image) */}
        <div style={{
          position: 'relative',
          filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.2))'
        }}>
          <img 
            src={getPetImage()}
            alt="Pet"
            style={{
              width: 300,
              height: 300,
              objectFit: 'contain',
              borderRadius: 12,
              transition: 'all 800ms cubic-bezier(0.4, 0, 0.2, 1)',
              animation: careLevel * 10 >= 30 && careLevel * 10 < 60 ? 'petGrow 800ms ease-out' : 
                        careLevel * 10 >= 60 ? 'petEvolve 800ms ease-out' : 'none'
            }}
          />
        </div>
        
        {/* Food bowl */}
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-80px)',
          fontSize: 40,
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
        }}>
          🥣
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 20,
        padding: '8px 20px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        backdropFilter: 'blur(10px)'
      }}>
        {actionStates.map((action) => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '16px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 12,
              minWidth: 80,
              transition: 'all 200ms ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'translateY(0px)';
            }}
          >
            {/* Status emoji */}
            {getStatusEmoji(action.status) && (
              <div style={{
                position: 'absolute',
                top: -8,
                right: 8,
                fontSize: 20,
                background: 'white',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}>
                {getStatusEmoji(action.status)}
              </div>
            )}
            
            {/* Action icon */}
            <div style={{
              fontSize: 60,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
            }}>
              {action.icon}
            </div>
            
            {/* Action label - small text below */}
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'white',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)'
            }}>
              {action.label}
            </div>
          </button>
        ))}
      </div>

      {/* Audio Toggle Button */}
      <button
        onClick={() => {
          setAudioEnabled(!audioEnabled);
          if (currentAudio) {
            currentAudio.pause();
            setCurrentAudio(null);
          }
        }}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: audioEnabled 
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 40,
          transition: 'all 200ms ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        }}
      >
        {audioEnabled ? '🔊' : '🔇'}
      </button>

      {/* Pet Shop Overlay */}
      {showPetShop && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: 20,
            padding: '24px',
            maxWidth: 450,
            width: '90%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            position: 'relative',
            border: '3px solid #e5e7eb'
          }}>
            {/* Close button */}
            <button
              onClick={() => setShowPetShop(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}
            >
              ×
            </button>

            {/* Header */}
            <div style={{
              textAlign: 'center',
              marginBottom: 20
            }}>
              <h2 style={{
                fontSize: 28,
                fontWeight: 700,
                color: '#1f2937',
                margin: 0,
                marginBottom: 6,
                fontFamily: 'Quicksand, system-ui, sans-serif'
              }}>
                🏪 Pet Shop
              </h2>
              <p style={{
                fontSize: 14,
                color: '#6b7280',
                margin: 0,
                fontWeight: 500
              }}>
                Adopt new animal friends!
              </p>
            </div>



            {/* Available Pets */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 16
            }}>
              {availablePets.map((pet) => {
                const isOwned = ownedPets.includes(pet.id);
                const canAfford = hasEnoughCoins(pet.cost);
                
                return (
                  <div
                    key={pet.id}
                    style={{
                      background: isOwned 
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                      borderRadius: 16,
                      padding: '16px',
                      textAlign: 'center',
                      position: 'relative',
                      cursor: isOwned ? 'default' : canAfford ? 'pointer' : 'not-allowed',
                      transition: 'all 200ms ease',
                      border: '2px solid rgba(255,255,255,0.2)',
                      opacity: isOwned ? 1 : canAfford ? 0.9 : 0.6
                    }}
                    onClick={() => !isOwned && canAfford && handlePetPurchase(pet.id, pet.cost)}
                    onMouseEnter={(e) => {
                      if (!isOwned && canAfford) {
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.2)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isOwned && canAfford) {
                        e.currentTarget.style.transform = 'translateY(0px) scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    {/* Lock overlay for all unowned pets */}
                    {!isOwned && (
                      <div style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 40,
                        height: 40,
                        background: canAfford ? 'rgba(59, 130, 246, 0.9)' : 'rgba(0,0,0,0.7)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        border: '2px solid white',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                      }}>
                        {canAfford ? '💰' : '🔒'}
                      </div>
                    )}

                    {/* Pet emoji */}
                    <div style={{
                      fontSize: 48,
                      marginBottom: 8,
                      filter: isOwned ? 'none' : !canAfford ? 'grayscale(100%) opacity(0.7)' : 'grayscale(50%) opacity(0.9)'
                    }}>
                      {pet.emoji}
                    </div>

                    {/* Pet name */}
                    <h3 style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: 'white',
                      margin: 0,
                      marginBottom: 6,
                      fontFamily: 'Quicksand, system-ui, sans-serif'
                    }}>
                      {pet.name}
                    </h3>

                    {/* Status/Price */}
                    <div style={{
                      fontSize: 14,
                      color: 'rgba(255,255,255,0.9)',
                      fontWeight: 500
                    }}>
                      {isOwned ? '✅ Owned' : canAfford ? `🪙 ${pet.cost} coins` : `🔒 Need ${pet.cost} coins`}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current coins display */}
            <div style={{
              textAlign: 'center',
              padding: '16px',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              borderRadius: 12,
              color: 'white',
              fontWeight: 600,
              fontSize: 16
            }}>
              💰 Your coins: {coins}
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes petGrow {
            0% {
              opacity: 0.7;
              transform: scale(0.95);
            }
            50% {
              opacity: 0.9;
              transform: scale(1.05);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          @keyframes petEvolve {
            0% {
              opacity: 0.6;
              transform: scale(0.9) rotate(-2deg);
            }
            25% {
              opacity: 0.8;
              transform: scale(1.1) rotate(1deg);
            }
            50% {
              opacity: 0.9;
              transform: scale(0.98) rotate(-0.5deg);
            }
            75% {
              opacity: 0.95;
              transform: scale(1.02) rotate(0.5deg);
            }
            100% {
              opacity: 1;
              transform: scale(1) rotate(0deg);
            }
          }
          
          @keyframes heartbeat {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.1);
            }
          }
          
          @keyframes heartFlyFromPet1 {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
            50% {
              transform: translate(200px, -150px) scale(0.8);
              opacity: 0.8;
            }
            100% {
              transform: translate(350px, -280px) scale(0.3);
              opacity: 0;
            }
          }
          
          @keyframes heartFlyFromPet2 {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
            50% {
              transform: translate(180px, -120px) scale(0.7);
              opacity: 0.9;
            }
            100% {
              transform: translate(330px, -300px) scale(0.2);
              opacity: 0;
            }
          }
          
          @keyframes heartFlyFromPet3 {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
            50% {
              transform: translate(220px, -180px) scale(0.9);
              opacity: 0.7;
            }
            100% {
              transform: translate(370px, -260px) scale(0.4);
              opacity: 0;
            }
          }
          
          @keyframes thoughtBubble {
            0%, 100% {
              transform: scale(1);
              opacity: 0.7;
            }
            50% {
              transform: scale(1.2);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
}
