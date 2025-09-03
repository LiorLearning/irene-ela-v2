import React, { useState } from 'react';
import { Button } from './components/Button';

type Props = {
  onSelectStory?: (storyId: string, mode?: 'adventure' | 'picture-book') => void;
  onCreateNewStory?: () => void;
  onOpenPets?: () => void;
};

export function LandingPage({ onSelectStory, onCreateNewStory, onOpenPets }: Props): JSX.Element {
  const [selectedGrade, setSelectedGrade] = useState<string>('2');
  const [selectedLevel, setSelectedLevel] = useState<'start' | 'mid'>('start');
  const [showCompanionTooltip, setShowCompanionTooltip] = useState(false);

  const handleStorySelect = (storyId: string, mode?: 'adventure' | 'picture-book') => {
    onSelectStory?.(storyId, mode);
  };

  const handleCreateNew = () => {
    onCreateNewStory?.();
  };

  const handlePublishStory = (storyId: string) => {
    console.log('Publishing story:', storyId);
    // Add your publish logic here
    alert('🎉 Story published successfully!');
  };

  const continueStories = [
    {
      id: 'create-new',
      title: 'Create New Story',
      emoji: '✨',
      color: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      isCreateNew: true,
      imageUrl: undefined,
      pages: undefined
    },

    {
      id: 'two-sisters',
      title: 'Two Sisters',
      author: 'by Irene, 3rd grade',
      pages: '8 pages',
      emoji: '🌲',
      imageUrl: 'https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fd1ptidrpttdm41.cloudfront.net%252Ftestuser4%252F20250826_150624.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN',
      color: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      isCreateNew: false
    }
  ];

  const topPicksStories = [
    {
      id: 'stella-tiny-frog',
      title: 'Stella and the Tiny Frog',
      author: 'by Irene, 2nd grade',
      pages: '15 pages',
      badge: '❤️ "Best Friendship!"',
      imageUrl: 'https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250819_154510_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN',
      emoji: '🐸',
      color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    },

    {
      id: 'captain-asher-time-stranglers',
      title: 'Captain Asher and the Time Stranglers',
      author: 'by Asher Elliman, 3rd grade',
      pages: '65 pages',
      badge: '🌟 "Epic Twist!"',
      imageUrl: 'https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fd1ptidrpttdm41.cloudfront.net%252FAsherE%252F20250815_174915.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN',
      emoji: '🚀',
      color: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
    },

    {
      id: 'roblox-showdown',
      title: 'Roblox Showdown',
      author: 'by Iker, 4th grade',
      pages: '5 pages',
      badge: '🎢 "Thrilling!"',
      emoji: '✨',
      imageUrl: 'https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fd1ptidrpttdm41.cloudfront.net%252FIker%252F20250826_223658.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN',
      color: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      isCreateNew: false
    }
  ];

  const AICompanion = () => {
    return (
      <div 
        style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          zIndex: 1000,
          cursor: 'pointer'
        }}
        onMouseEnter={() => setShowCompanionTooltip(true)}
        onMouseLeave={() => setShowCompanionTooltip(false)}
      >
        {/* Tooltip */}
        {showCompanionTooltip && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: 12,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '12px 16px',
            borderRadius: 16,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: 'Quicksand, system-ui, sans-serif',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            whiteSpace: 'nowrap',
            transform: 'translateY(-4px)',
            animation: 'fadeInUp 200ms ease-out'
          }}>
            <div style={{ marginBottom: 4, fontWeight: 600 }}>🤖 AI Writing Assistant</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Click to chat with me!</div>
            {/* Arrow pointing down */}
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 24,
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #667eea'
            }} />
          </div>
        )}

        {/* Main Avatar Circle */}
        <div 
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff9a56 0%, #ffad56 100%)',
            border: '4px solid #2d3748',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            transition: 'all 300ms ease',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1) translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1) translateY(0px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
          }}
        >
          {/* Astronaut Emoji/Character */}
          <div style={{
            fontSize: 40,
            transform: 'translateY(-2px)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
          }}>
            🧑‍🚀
          </div>

          {/* Subtle shine effect */}
          <div style={{
            position: 'absolute',
            top: -20,
            left: -20,
            width: 40,
            height: 40,
            background: 'linear-gradient(45deg, rgba(255,255,255,0.3) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'shine 3s ease-in-out infinite'
          }} />
        </div>

        {/* Pulsing Ring Effect */}
        <div style={{
          position: 'absolute',
          top: -8,
          left: -8,
          width: 96,
          height: 96,
          borderRadius: '50%',
          border: '2px solid rgba(102, 126, 234, 0.3)',
          animation: 'pulse 2s ease-in-out infinite'
        }} />

        {/* Status Indicator */}
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
          border: '2px solid white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }} />
      </div>
    );
  };

  const GradeSelector = () => {
    const grades = [
      { value: 'K', label: 'Kindergarten' },
      { value: '1', label: '1st Grade' },
      { value: '2', label: '2nd Grade' },
      { value: '3', label: '3rd Grade' },
      { value: '4', label: '4th Grade' },
      { value: '5', label: '5th Grade' }
    ];
    
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredGrade, setHoveredGrade] = useState<string | null>(null);

    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 20px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '2px solid #e5e7eb',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 600,
            color: '#374151',
            fontFamily: 'Quicksand, system-ui, sans-serif',
            transition: 'all 200ms ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
            e.currentTarget.style.transform = 'translateY(0px)';
          }}
        >
          <span>📚</span>
          <span>Grade {selectedGrade} - {selectedLevel === 'start' ? 'Start' : 'Mid'}</span>
          <span style={{ 
            fontSize: 14, 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease'
          }}>
            ▼
          </span>
        </button>

        {isOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            background: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: 16,
            boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: 240,
            overflow: 'visible'
          }}>
            {grades.map((grade, index) => (
              <div 
                key={grade.value}
                style={{ position: 'relative' }}
                onMouseEnter={() => setHoveredGrade(grade.value)}
                onMouseLeave={() => setHoveredGrade(null)}
              >
                {/* Primary Grade Option */}
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '16px 20px',
                    border: 'none',
                    background: (selectedGrade === grade.value || hoveredGrade === grade.value) ? '#f8fafc' : 'white',
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#374151',
                    cursor: 'pointer',
                    fontFamily: 'Quicksand, system-ui, sans-serif',
                    transition: 'all 150ms ease',
                    borderBottom: index === grades.length - 1 ? 'none' : '1px solid #f3f4f6',
                    borderTopLeftRadius: index === 0 ? 14 : 0,
                    borderTopRightRadius: index === 0 ? 14 : 0,
                    borderBottomLeftRadius: index === grades.length - 1 ? 14 : 0,
                    borderBottomRightRadius: index === grades.length - 1 ? 14 : 0
                  }}
                >
                  <span>{grade.label}</span>
                  <span style={{ 
                    fontSize: 14, 
                    color: '#9ca3af',
                    opacity: hoveredGrade === grade.value ? 1 : 0.6,
                    transition: 'opacity 150ms ease'
                  }}>
                    ◀
                  </span>
                </button>

                {/* Level Submenu */}
                {hoveredGrade === grade.value && (
                  <div style={{
                    position: 'absolute',
                    right: '100%',
                    top: 0,
                    marginRight: 8,
                    background: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: 12,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                    minWidth: 140,
                    zIndex: 1001,
                    overflow: 'hidden'
                  }}>
                    <button
                      onClick={() => {
                        setSelectedGrade(grade.value);
                        setSelectedLevel('start');
                        setIsOpen(false);
                        setHoveredGrade(null);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '12px 18px',
                        border: 'none',
                        background: selectedGrade === grade.value && selectedLevel === 'start' ? '#f0f9ff' : 'white',
                        color: selectedGrade === grade.value && selectedLevel === 'start' ? '#0369a1' : '#374151',
                        fontSize: 14,
                        fontWeight: selectedGrade === grade.value && selectedLevel === 'start' ? 600 : 500,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'Quicksand, system-ui, sans-serif',
                        transition: 'all 150ms ease',
                        borderBottom: '1px solid #f3f4f6'
                      }}
                      onMouseEnter={(e) => {
                        if (!(selectedGrade === grade.value && selectedLevel === 'start')) {
                          e.currentTarget.style.background = '#f8fafc';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!(selectedGrade === grade.value && selectedLevel === 'start')) {
                          e.currentTarget.style.background = 'white';
                        }
                      }}
                    >
                      Start
                    </button>
                    <button
                      onClick={() => {
                        setSelectedGrade(grade.value);
                        setSelectedLevel('mid');
                        setIsOpen(false);
                        setHoveredGrade(null);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '12px 18px',
                        border: 'none',
                        background: selectedGrade === grade.value && selectedLevel === 'mid' ? '#f0f9ff' : 'white',
                        color: selectedGrade === grade.value && selectedLevel === 'mid' ? '#0369a1' : '#374151',
                        fontSize: 14,
                        fontWeight: selectedGrade === grade.value && selectedLevel === 'mid' ? 600 : 500,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'Quicksand, system-ui, sans-serif',
                        transition: 'all 150ms ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!(selectedGrade === grade.value && selectedLevel === 'mid')) {
                          e.currentTarget.style.background = '#f8fafc';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!(selectedGrade === grade.value && selectedLevel === 'mid')) {
                          e.currentTarget.style.background = 'white';
                        }
                      }}
                    >
                      Middle
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Overlay to close dropdown when clicking outside */}
        {isOpen && (
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999
            }}
          />
        )}
      </div>
    );
  };

  const AuthorLevelBadge = () => {
    const currentLevel = 2;
    const nextLevel = currentLevel + 1;
    const currentTitle = 'Story Scribbler';
    const upcomingTitle = 'Plot Weaver';
    const progressToNext = 0.35; // 35% toward next level

    const ringBackground = `conic-gradient(#10b981 ${Math.round(progressToNext * 100)}%, #e5e7eb ${Math.round(progressToNext * 100)}%)`;

    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 16,
        padding: '20px 24px',
        borderRadius: 16,
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid #e5e7eb',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
      }}>
        {/* Circular level indicator */}
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: ringBackground,
          display: 'grid',
          placeItems: 'center'
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#fff',
            display: 'grid',
            placeItems: 'center',
            color: '#10b981',
            fontWeight: 800,
            fontSize: 24
          }}>
            {currentLevel}
          </div>
        </div>
        {/* Textual level info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#111827',
            fontFamily: 'Quicksand, system-ui, sans-serif'
          }}>
            You're a {currentTitle}!
          </div>
          <div style={{
            fontSize: 16,
            color: '#6b7280',
            fontWeight: 600
          }}>
            Level {nextLevel}: {upcomingTitle} (write 2 more chapters)
          </div>
        </div>
      </div>
    );
  };

  const StoryCard = ({ 
    title, 
    emoji, 
    color, 
    onClick, 
    isCreateNew = false,
    imageUrl,
    author,
    pages,
    badge,
    showPublishButton = false,
    onPublish
  }: { 
    title: string; 
    emoji: string; 
    color: string; 
    onClick: () => void;
    isCreateNew?: boolean;
    imageUrl?: string;
    author?: string;
    pages?: string;
    badge?: string;
    showPublishButton?: boolean;
    onPublish?: () => void;
  }) => (
    <div
      onClick={onClick}
      style={{
        borderRadius: 20,
        cursor: 'pointer',
        transition: 'all 200ms ease',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0px) scale(1)';
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px) scale(0.99)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
      }}
    >
      {imageUrl ? (
        /* Portrait book cover style */
        <>
          <div style={{
            position: 'relative',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            border: '3px solid rgba(255,255,255,0.9)',
            width: isCreateNew ? 280 : 320,
            flexShrink: 0
          }}>
            <img 
              src={imageUrl} 
              alt={title}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block'
              }}
            />
          </div>
          {/* Title and info below image */}
          <div style={{
            marginTop: 20,
            textAlign: 'center',
            maxWidth: isCreateNew ? 280 : 320
          }}>
            <h3 style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              color: '#1f2937',
              fontFamily: 'Quicksand, system-ui, sans-serif',
              lineHeight: 1.3,
              marginBottom: author ? 12 : 0
            }}>
              {title}
            </h3>
            {author && (
              <p style={{
                margin: 0,
                fontSize: 16,
                color: '#6b7280',
                fontWeight: 500,
                marginBottom: pages ? 8 : 0
              }}>
                {author}
              </p>
            )}
            {pages && (
              <p style={{
                margin: 0,
                fontSize: 14,
                color: '#9ca3af',
                fontWeight: 500,
                marginBottom: badge ? 12 : 0
              }}>
                {pages}
              </p>
            )}
            {badge && (
              <div style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                border: '2px solid #f59e0b',
                borderRadius: 20,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: '#92400e',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)',
                marginBottom: showPublishButton ? 16 : 0
              }}>
                {badge}
              </div>
            )}
            {showPublishButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPublish?.();
                }}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 12,
                  padding: '12px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  transition: 'all 200ms ease',
                  fontFamily: 'Quicksand, system-ui, sans-serif',
                  marginTop: badge ? 0 : (pages ? 16 : (author ? 16 : 12))
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(0px) scale(0.95)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
                }}
              >
                📚 Publish Story
              </button>
            )}
          </div>
        </>
      ) : (
        /* Traditional card style for non-image items */
        <div style={{
          background: color,
          borderRadius: 24,
          padding: '48px 40px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
          border: '3px solid rgba(255,255,255,0.2)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: isCreateNew ? 280 : 220,
          width: isCreateNew ? 280 : '100%',
          maxWidth: isCreateNew ? 280 : 320,
          flexShrink: isCreateNew ? 0 : 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          {/* Background pattern */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at 100% 0%, rgba(255,255,255,0.1) 0%, transparent 50%)',
            pointerEvents: 'none'
          }} />
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
            gap: 12
          }}>
            <div style={{
              fontSize: isCreateNew ? 72 : 64,
              lineHeight: 1,
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
              marginBottom: 16
            }}>
              {emoji}
            </div>
            <h3 style={{
              margin: 0,
              fontSize: isCreateNew ? 28 : 24,
              fontWeight: 700,
              color: 'white',
              textShadow: '0 3px 6px rgba(0,0,0,0.3)',
              fontFamily: 'Quicksand, system-ui, sans-serif'
            }}>
              {title}
            </h3>
            {isCreateNew && (
              <div style={{
                fontSize: 18,
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 500,
                marginTop: 12
              }}>
                Start your adventure
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 0.6;
            }
            50% {
              transform: scale(1.1);
              opacity: 0.8;
            }
          }
          
          @keyframes shine {
            0%, 100% {
              transform: translateX(-100%) translateY(-100%) rotate(45deg);
              opacity: 0;
            }
            50% {
              transform: translateX(50%) translateY(50%) rotate(45deg);
              opacity: 1;
            }
          }
          
          @keyframes fadeInUp {
            0% {
              opacity: 0;
              transform: translateY(8px);
            }
            100% {
              opacity: 1;
              transform: translateY(-4px);
            }
          }
        `}
      </style>
      
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        padding: '48px 32px',
        fontFamily: 'Quicksand, system-ui, sans-serif'
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 64
        }}>
          {/* Welcome Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24
        }}>
          <div>
            <h1 style={{
              fontSize: 48,
              fontWeight: 700,
              color: '#1f2937',
              margin: 0,
              fontFamily: 'Quicksand, system-ui, sans-serif',
              textShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              📚 Welcome back, Irene!
            </h1>
            <div style={{ marginTop: 20 }}>
              <AuthorLevelBadge />
            </div>
          </div>
          <div style={{ 
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}>
            {/* Your Pets Button */}
            <button
              onClick={onOpenPets}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 20px',
                borderRadius: 16,
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'Quicksand, system-ui, sans-serif',
                boxShadow: '0 8px 24px rgba(34, 197, 94, 0.3)',
                transition: 'all 200ms ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(34, 197, 94, 0.4)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(34, 197, 94, 0.3)';
                e.currentTarget.style.transform = 'translateY(0px)';
              }}
            >
              <span>🐕</span>
              <span>Your Pets</span>
            </button>
            <GradeSelector />
          </div>
        </div>

        {/* Continue Your Story Section */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 32
          }}>
            <span style={{ fontSize: 32 }}>📖</span>
            <h2 style={{
              fontSize: 36,
              fontWeight: 700,
              color: '#1f2937',
              margin: 0,
              fontFamily: 'Quicksand, system-ui, sans-serif'
            }}>
              Continue Your Story
            </h2>
          </div>
          
          <div style={{
            display: 'flex',
            gap: 40,
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            alignItems: 'flex-start'
          }}>
            {continueStories.map((story) => (
              <StoryCard
                key={story.id}
                title={story.title}
                emoji={story.emoji}
                color={story.color}
                isCreateNew={story.isCreateNew}
                imageUrl={story.imageUrl}
                author={story.author}
                pages={story.pages}
                showPublishButton={story.id === 'captain-asher-time-stranglers' || story.id === 'two-sisters'}
                onPublish={() => handlePublishStory(story.id)}
                onClick={() => story.isCreateNew ? handleCreateNew() : handleStorySelect(story.id, 'adventure')}
              />
            ))}
          </div>
        </div>

        {/* Top Picks Section */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 32
          }}>
            <span style={{ fontSize: 32 }}>🔥</span>
            <h2 style={{
              fontSize: 36,
              fontWeight: 700,
              color: '#1f2937',
              margin: 0,
              fontFamily: 'Quicksand, system-ui, sans-serif'
            }}>
              Top Picks of the Week
            </h2>
          </div>
          
          <div style={{
            display: 'flex',
            gap: 40,
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            alignItems: 'flex-start'
          }}>
            {topPicksStories.map((story) => (
              <StoryCard
                key={story.id}
                title={story.title}
                emoji={story.emoji}
                color={story.color}
                imageUrl={story.imageUrl}
                author={story.author}
                pages={story.pages}
                badge={story.badge}
                onClick={() => handleStorySelect(story.id, 'picture-book')}
              />
            ))}
          </div>
        </div>

        {/* Footer spacing */}
        <div style={{ height: 60 }} />
      </div>
      
      {/* AI Companion */}
      <AICompanion />
    </div>
    </>
  );
}
