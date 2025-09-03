import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStory } from '../story/StoryStore';
import bg1Url from '../../../bg2.png';
import { audioManager } from '../audioManager';
import { useCoins } from '../coinSystem';
// import '../../../api/image'

type Props = {
  selectedStoryId?: string | null;
  onAdventureMessage?: (userMessage: string) => void;
  onStoryUpdate?: (storyUpdate: string) => void;
  adventureMessages?: Array<{ role: 'ai' | 'student'; text: string; isImage?: boolean; isLoading?: boolean; imageUrl?: string }>;
  onAdventureMessagesUpdate?: (messages: Array<{ role: 'ai' | 'student'; text: string; isImage?: boolean; isLoading?: boolean; imageUrl?: string }>) => void;
  onSwitchToQuestions?: () => void;
  onGoToPrevious?: () => void;
  onSpellingComplete?: (isComplete: boolean) => void;
  onNavigateToPetStore?: () => void;
};

export function AdventureMode2({ selectedStoryId, onAdventureMessage, onStoryUpdate, adventureMessages: propAdventureMessages, onAdventureMessagesUpdate, onSwitchToQuestions, onGoToPrevious, onSpellingComplete, onNavigateToPetStore }: Props): JSX.Element {
  const { state: storyState, appendMessage: appendStoryMessage, reset: resetStory, consumePendingAdventureChat, setMetadata } = useStory();
  const { coins, addCoins } = useCoins();
  
  // Get story-specific context based on selectedStoryId
  const getStoryContext = () => {
    switch (selectedStoryId) {
      case 'two-sisters':
        return {
          defaultMessage: "🌲✨ Welcome to the mystical forest, Irene! I'm Shadow, your mysterious guide, and I have secrets to share with you. The forest whispers with magic, and glowing mushrooms light our path. Your sister is waiting somewhere in the shadows, but first we must learn to trust each other. Are you ready to discover the truth hidden in these enchanted woods?",
          protagonist: "Mia",
          username: "Irene",
          setting: "A mystical forest full of hidden mushrooms, glowing plants, and whispering animals",
          companions: "Shadow (mysterious black dog), Mia's Sister, The Boy Protector",
          theme: "courage, family bonds, and trust in animals"
        };
      case 'roblox-showdown':
      case 'captain-asher-time-stranglers':
      default:
        return {
          defaultMessage: "✨🌟 Welcome to our adventure session, Irene! I'm so excited to create an amazing story with you! What kind of adventure sparks your imagination today - magical forests with talking animals, space exploration with robotic friends, or would you like to create your very own adventure with your own setting and characters?",
          protagonist: "Irene",
          username: "Irene",
          setting: "Adventure creation space",
          companions: "loyal companion",
          theme: "creative storytelling and adventure exploration"
        };
    }
  };

  // Remove any blank-style markers from text (used to keep CHAT phase clean)
  const stripBlankPatternsFromText = (text: string): string => {
    if (!text) return text;
    let cleaned = text;
    // Replace [BLANK:word] → word
    cleaned = cleaned.replace(/\[BLANK:([^\]]*)\]/gi, (_, word) => (word || '').trim());
    // Replace ___word___ → word
    cleaned = cleaned.replace(/_{3,}([a-zA-Z]*)_{3,}/g, (_, word) => (word || '').trim());
    // Replace lone ___ sequences → ''
    cleaned = cleaned.replace(/_{3,}/g, '');
    return cleaned;
  };

  const storyContext = getStoryContext();
  
  // One-time migration to clean up existing messages with blanks
  // This removes blanks from all existing messages to fix the phase mismatch issue
  const migrateExistingMessages = (messages: Array<{ role: 'ai' | 'student'; text: string; isImage?: boolean; isLoading?: boolean; imageUrl?: string }>) => {
    const MIGRATION_KEY = 'adventure_mode2_blank_migration_v1';
    const hasMigrated = localStorage.getItem(MIGRATION_KEY);
    
    if (hasMigrated) {
      return messages; // Already migrated
    }
    
    console.log('[DEBUG] Running one-time migration to remove blanks from existing messages');
    
    const migratedMessages = messages.map((message, index) => {
      // Only process AI messages that might have blanks
      if (message.role !== 'ai' || message.isImage || message.isLoading || !message.text.includes('[BLANK:')) {
        return message;
      }
      
      // Remove all blanks and replace with the target words
      const cleanedText = message.text.replace(/\[BLANK:([^\]]*)\]/g, (match, word) => {
        return word || 'word';
      });
      
      console.log(`[DEBUG] Migrated message ${index}: "${message.text}" → "${cleanedText}"`);
      return { ...message, text: cleanedText };
    });
    
    // Mark migration as complete
    try {
      localStorage.setItem(MIGRATION_KEY, 'true');
    } catch (error) {
      console.warn('Failed to save migration flag:', error);
    }
    
    return migratedMessages;
  };

  // Use parent-provided messages or default/local persisted
  const defaultMessages: Array<{ role: 'ai' | 'student'; text: string; isImage?: boolean; isLoading?: boolean; imageUrl?: string }> = [
    { role: 'ai' as const, text: storyContext.defaultMessage }
  ];
  
  const rawMessages = (storyState?.adventureMessages?.length ?? 0) > 0
    ? (storyState.adventureMessages as any)
    : defaultMessages;
    
  const migratedMessages = migrateExistingMessages(rawMessages);
  const [localAdventureMessages, setLocalAdventureMessages] = useState<Array<{ role: 'ai' | 'student'; text: string; isImage?: boolean; isLoading?: boolean; imageUrl?: string }>>(
    migratedMessages
  );
  const adventureMessages = propAdventureMessages || localAdventureMessages;
  
  // Clear story store if migration occurred to prevent inconsistencies
  useEffect(() => {
    if (migratedMessages !== rawMessages && migratedMessages.length > 0) {
      console.log('[DEBUG] Migration occurred - clearing story store to prevent inconsistencies');
      resetStory();
    }
  }, []); // Run only once on mount
  
  // Helper to update messages (functional to avoid stale snapshots)
  const updateAdventureMessages = (updater: (prev: typeof adventureMessages) => typeof adventureMessages) => {
    setLocalAdventureMessages(prev => {
      const base = propAdventureMessages ?? prev;
      const next = updater(base as any);
      if (onAdventureMessagesUpdate) onAdventureMessagesUpdate(next);
      return next as any;
    });
  };
  const [adventureInput, setAdventureInput] = useState('');
  const [isAdventureRecording, setIsAdventureRecording] = useState(false);
  const [adventureSpeechRecognition, setAdventureSpeechRecognition] = useState<any>(null);
  // Keep accumulated transcript across interim/final events and potential auto-restarts
  const adventureAccumulatedRef = useRef<string>('');
  const adventureRecordingRef = useRef<boolean>(false);
  const adventureInputRef = useRef<HTMLInputElement>(null);
  
  // Adventure state management
  const [adventureState, setAdventureState] = useState<'new' | 'ongoing' | 'character_creation'>('ongoing');
  
  // Phase management for Adventure Mode 2: 3 chats → 3 questions → 3 chats → 3 questions...
  const PHASE_STATE_STORAGE_KEY = 'adventure_mode2_phase_state';
  
  // Load phase state from localStorage
  const loadPhaseStateFromStorage = () => {
    try {
      const stored = localStorage.getItem(PHASE_STATE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('[DEBUG] Loaded phase state from localStorage:', parsed);
        return parsed;
      }
    } catch (error) {
      console.warn('Failed to load phase state from localStorage:', error);
    }
    return { currentPhase: 'chat', phaseProgress: 0, totalInteractions: 0 };
  };
  
  const initialPhaseState = loadPhaseStateFromStorage();
  const [currentPhase, setCurrentPhase] = useState<'chat' | 'question'>(initialPhaseState.currentPhase);
  const [phaseProgress, setPhaseProgress] = useState(initialPhaseState.phaseProgress); // 0-2 for each phase
  const [totalInteractions, setTotalInteractions] = useState(initialPhaseState.totalInteractions);
  
  // Save phase state to localStorage whenever it changes
  useEffect(() => {
    const phaseState = { currentPhase, phaseProgress, totalInteractions };
    try {
      localStorage.setItem(PHASE_STATE_STORAGE_KEY, JSON.stringify(phaseState));
      console.log('[DEBUG] Saved phase state to localStorage:', phaseState);
    } catch (error) {
      console.warn('Failed to save phase state to localStorage:', error);
    }
  }, [currentPhase, phaseProgress, totalInteractions]);

  // Target words for spelling challenges - CVC words with short "o" and short "u"
  const targetWords: string[] = [
    // CVC words with short "o"
    'box', 'fox', 'pot', 'hot', 'dot', 'lot', 'got',
    'hop', 'top', 'mop', 'cop', 'pop', 'job', 'rob',
    'log', 'dog', 'fog', 'jog', 'nod', 'rod', 'mom', 'not',
    // CVC words with short "u"
    'bug', 'hug', 'mug', 'rug', 'tug', 'jug', 'pug',
    'bus', 'cut', 'hut', 'nut', 'but', 'run', 'fun', 'sun',
    'gun', 'bun', 'mud', 'cup', 'pup', 'gum', 'sum', 'hum'
  ].sort(() => Math.random() - 0.5); // Randomize the order

  // Function to get current phase and target words
  const getCurrentPhaseInfo = () => {
    // Adjust by subtracting 1 to make phases align correctly:
    // Interactions 1,2,3 = phase 0 (chat), 4,5,6 = phase 1 (question), etc.
    const adjustedInteractions = Math.max(0, totalInteractions - 1);
    const phaseIndex = Math.floor(adjustedInteractions / 3); // Each phase has 3 interactions
    const withinPhaseIndex = adjustedInteractions % 3;
    const isQuestionPhase = phaseIndex % 2 === 1; // Odd phases are question phases
    
    return {
      phase: isQuestionPhase ? 'question' as const : 'chat' as const,
      phaseIndex,
      withinPhaseIndex,
      isQuestionPhase
    };
  };

  // Function to insert blanks into AI response for question phases (1 blank only)
  const insertBlanksIntoResponse = (response: string, targetWordsToUse: string[]) => {
    let modifiedResponse = response;
    
    // Use only the first target word (should be only 1 anyway)
    const targetWord = targetWordsToUse[0];
    
    if (targetWord) {
      console.log(`[DEBUG] Attempting to insert blank for word: "${targetWord}" in response: "${response}"`);
      
      // Check if the word is already inside a [BLANK:...] marker
      const existingBlankPattern = new RegExp(`\\[BLANK:[^\\]]*${targetWord}[^\\]]*\\]`, 'i');
      if (existingBlankPattern.test(modifiedResponse)) {
        console.log(`[DEBUG] Word "${targetWord}" already in blank, skipping`);
        return modifiedResponse;
      }
      
      // Create a case-insensitive regex to find the word (only first occurrence)
      const wordRegex = new RegExp(`\\b${targetWord}\\b`, 'i');
      if (wordRegex.test(modifiedResponse)) {
        // Replace only the first occurrence with blank format
        modifiedResponse = modifiedResponse.replace(wordRegex, `[BLANK:${targetWord.toLowerCase()}]`);
        console.log(`[DEBUG] Successfully inserted blank for "${targetWord}". Result: "${modifiedResponse}"`);
      } else {
        // If the exact word isn't found, try to find similar words or force insert a blank
        console.log(`[DEBUG] Target word "${targetWord}" not found in response. Attempting fallback insertion.`);
        
        // Try to find words that contain the target word as a substring
        const words = response.split(/\s+/);
        let foundSimilar = false;
        
        for (let i = 0; i < words.length && !foundSimilar; i++) {
          const word = words[i];
          if (!word) continue;
          
          const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
          
          // Check if this word contains our target word or is very similar
          if (cleanWord.includes(targetWord.toLowerCase()) || 
              targetWord.toLowerCase().includes(cleanWord)) {
            // Replace this word with our target word in a blank
            const wordPattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            modifiedResponse = modifiedResponse.replace(wordPattern, `[BLANK:${targetWord.toLowerCase()}]`);
            foundSimilar = true;
            console.log(`[DEBUG] Found similar word "${word}", replaced with blank for "${targetWord}"`);
          }
        }
        
        // If still no match, force insert at the end of the first sentence
        if (!foundSimilar) {
          const sentences = modifiedResponse.split(/[.!?]/);
          if (sentences.length > 0 && sentences[0] && sentences[0].trim()) {
            const firstSentence = sentences[0].trim();
            const restOfText = modifiedResponse.substring(firstSentence.length);
            modifiedResponse = `${firstSentence} [BLANK:${targetWord.toLowerCase()}]${restOfText}`;
            console.log(`[DEBUG] Force inserted blank for "${targetWord}" at end of first sentence`);
          }
        }
      }
    }
    
    return modifiedResponse;
  };

  // Function to select target word for current question phase (1 word per message)
  const selectTargetWords = (phaseIndex: number, withinPhaseIndex: number): string[] => {
    // Select 1 word per message, cycling through the word list
    const baseIndex = phaseIndex * 3 + withinPhaseIndex;
    let wordIndex = baseIndex % targetWords.length;
    
    // Get the single target word
    const targetWord = targetWords[wordIndex];
    
    // Return array with single word for consistency with existing code
    if (targetWord) {
      return [targetWord];
    } else if (targetWords.length > 0 && targetWords[0]) {
      return [targetWords[0]];
    } else {
      return ['approach']; // Fallback to a grade 4 spelling word
    }
  };
  
  // Track spelling completion status to control input availability
  const [isCurrentSpellingComplete, setIsCurrentSpellingComplete] = useState<boolean>(true); // Default to true for messages without spelling

  // Handle spelling completion updates from FillInTheBlankMessage
  const handleSpellingComplete = React.useCallback((isComplete: boolean) => {
    setIsCurrentSpellingComplete(isComplete);
  }, []);

  // Reset spelling completion when new messages arrive
  React.useEffect(() => {
    // Check if the latest AI message has blanks
    const latestAIMessage = adventureMessages.slice().reverse().find(m => m.role === 'ai' && !m.isLoading && !m.isImage);
    if (latestAIMessage) {
      const hasBlankPattern = /(\[BLANK(?::[^\]]+)?\]|_{3,}[a-zA-Z]*_{3,}|_{3,})/g.test(latestAIMessage.text);
      if (!hasBlankPattern) {
        // No blanks in latest message, enable input
        setIsCurrentSpellingComplete(true);
      } else {
        // Has blanks, disable input until completed
        setIsCurrentSpellingComplete(false);
      }
    }
  }, [adventureMessages]);
  
  // Message counter for Begin Challenge trigger (count user messages only)
  const [userMessageCount, setUserMessageCount] = useState(0);
  // Initialize currentAdventure based on story context
  const getInitialAdventure = () => {
    switch (selectedStoryId) {
      case 'two-sisters':
        return {
          type: 'mystical forest adventure with magical creatures and family mysteries',
          protagonist: 'Mia (brave sister searching for her lost sibling)',
          sidekick: 'Shadow (mysterious black dog with ancient wisdom)',
          teammates: 'The Boy Protector (guardian of the forest)',
          setting: 'A mystical forest full of hidden mushrooms, glowing plants, and whispering animals',
          goal: 'find the missing sister, uncover forest secrets, and build trust with magical creatures',
          villain: 'The Forest\'s Dark Secret (mysterious force that separates families)',
          recentEvent: 'Shadow appeared from the shadows, offering to guide Irene through the mystical forest to find her sister'
        };
      case 'roblox-showdown':
      case 'captain-asher-time-stranglers':
        return {
          type: 'epic Roblox adventure with forest magic, digital technology, and heroic battles',
          protagonist: 'Mateo (forest-powered hero with armor made of glowing vines, crown of leaves, and powers that spawn magical trees)',
          sidekick: 'Glitcherino (wooden robot with all-brown outfit, springy limbs, and a banana-powered joke blaster)',
          teammates: 'Iker (brave, creative hero wearing a gamer-style outfit, glowing blue visor, and digital cape)',
          setting: 'Cratered Roblox HQ after being struck by ten asteroids; neon wires, shattered labs, and moon rocks scattered across a techy battlefield',
          goal: 'defeat the Shadow King, protect the digital realm, master forest magic and technology, and restore peace to Roblox HQ',
          villain: 'The Shadow King (armored in dark metal, with powerful shadow magic and a glowing wand; seeks revenge after being banned by David Bazuki)',
          recentEvent: 'Mateo used an epic tree cage to trap the Shadow King, but his wand is breaking free; below, a sleepy Sea Eater shark awakened and was lulled to sleep—when a GIANT Earthworm emerged from the depths!'
        };
      default:
        // For new stories, use the context from getStoryContext
        return {
          type: storyContext.theme,
          protagonist: storyContext.protagonist,
          sidekick: storyContext.companions,
          setting: storyContext.setting,
          goal: 'create an amazing adventure together',
          recentEvent: 'A new adventure is about to begin!'
        };
    }
  };

  const [currentAdventure, setCurrentAdventure] = useState<{
    type?: string;
    protagonist?: string;
    sidekick?: string;
    teammates?: string;
    villain?: string;
    goal?: string;
    setting?: string;
    recentEvent?: string;
  }>(getInitialAdventure());
  const ADVENTURE_IMAGE_OVERLAY_OPACITY = 0.45;
  const adventureScrollRef = useRef<HTMLDivElement | null>(null);

  // Message history management for weighted image generation (both user and AI)
  const CONVERSATION_MESSAGES_KEY = 'adventure_conversation_history';
  const MAX_STORED_CONVERSATION_MESSAGES = 20; // Store more to have good context

  // Get the last 6 conversation messages for lightweight context (OpenAI-style)
  const getLastConversationMessages = (): Array<{role: 'user' | 'ai', text: string}> => {
    // Get recent messages from current conversation, excluding loading/image messages
    const recentMessages = adventureMessages
      .filter(m => !m.isLoading && !m.isImage && m.text.trim())
      .slice(-6) // Last 6 messages for lighter context
      .map(m => ({
        role: m.role === 'student' ? 'user' as const : 'ai' as const,
        text: m.text
      }));
    
    return recentMessages;
  };

  const generateWeightedPrompt = (currentMessage: string, conversationHistory: Array<{role: 'user' | 'ai', text: string}>): string => {
    // OpenAI-style weighting: Current request = 85% anchor, History = 15% total
    const ANCHOR_WEIGHT = 0.85; // 85% for current user request
    const HISTORY_BUDGET = 0.15; // 15% total for all history
    
    // Distribute history budget across last 5 messages with decay
    // [0.05, 0.04, 0.03, 0.02, 0.01] = 0.15 total
    const historyWeights = [0.05, 0.04, 0.03, 0.02, 0.01];
    
    // Role multipliers to slightly favor user intent for image generation
    const getRoleMultiplier = (role: 'user' | 'ai') => role === 'user' ? 1.00 : 0.85;
    
    let weightedPrompt = '';
    
    // Current message gets 85% weight (the anchor)
    weightedPrompt += `${currentMessage}`;
    
    // Process conversation history (most recent first) with light context injection
    const reversedHistory = [...conversationHistory].reverse(); // Most recent first
    
    reversedHistory.forEach((message, index) => {
      if (message.text.trim() && index < historyWeights.length) {
        const baseWeight = historyWeights[index] ?? 0.01; // Fallback weight
        const roleMultiplier = getRoleMultiplier(message.role);
        const finalWeight = baseWeight * roleMultiplier;
        
        // Only include if relevant - light context injection like OpenAI
        if (finalWeight >= 0.025) { // Only include meaningful context
          const contextPrefix = message.role === 'user' ? 'Context from user' : 'Context from conversation';
          weightedPrompt += ` (${contextPrefix}: ${message.text})`;
        }
      }
    });
    
    return weightedPrompt.trim();
  };

  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);

  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const [audioLoading, setAudioLoading] = useState<number | null>(null);
  const [autoPlayedMessages, setAutoPlayedMessages] = useState<Set<number>>(new Set());
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasUserGestureRef = useRef<boolean>(false);
  // Track which message text the current audio corresponds to for reliable toggling
  const currentAdventureAudioLabelRef = useRef<string | null>(null);

  // State for managing fill-in-the-blank answers with localStorage persistence
  const BLANK_ANSWERS_STORAGE_KEY = 'adventure_mode2_blank_answers';
  const MESSAGE_ID_MAPPING_STORAGE_KEY = 'adventure_mode2_message_id_mapping';
  
  // Load initial blank answers from localStorage
  const loadBlankAnswersFromStorage = (): Record<string, Record<number, string>> => {
    try {
      const stored = localStorage.getItem(BLANK_ANSWERS_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      console.log('[DEBUG] Loaded blank answers from localStorage:', parsed);
      console.log('[DEBUG] Available message IDs in storage:', Object.keys(parsed));
      return parsed;
    } catch (error) {
      console.warn('Failed to load blank answers from localStorage:', error);
      return {};
    }
  };
  
  // Load message ID mappings from localStorage
  const loadMessageIdMappingsFromStorage = (): Record<string, string> => {
    try {
      const stored = localStorage.getItem(MESSAGE_ID_MAPPING_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      console.log('[DEBUG] Loaded message ID mappings from localStorage:', parsed);
      return parsed;
    } catch (error) {
      console.warn('Failed to load message ID mappings from localStorage:', error);
      return {};
    }
  };
  
  const [blankAnswers, setBlankAnswers] = useState<Record<string, Record<number, string>>>(loadBlankAnswersFromStorage);
  const [messageIdMappings, setMessageIdMappings] = useState<Record<string, string>>(loadMessageIdMappingsFromStorage);
  
  // Save blank answers to localStorage whenever they change
  const saveBlankAnswersToStorage = (answers: Record<string, Record<number, string>>) => {
    try {
      localStorage.setItem(BLANK_ANSWERS_STORAGE_KEY, JSON.stringify(answers));
      console.log('[DEBUG] Saved blank answers to localStorage:', answers);
    } catch (error) {
      console.warn('Failed to save blank answers to localStorage:', error);
    }
  };
  
  // Save message ID mappings to localStorage whenever they change
  const saveMessageIdMappingsToStorage = (mappings: Record<string, string>) => {
    try {
      localStorage.setItem(MESSAGE_ID_MAPPING_STORAGE_KEY, JSON.stringify(mappings));
      console.log('[DEBUG] Saved message ID mappings to localStorage:', mappings);
    } catch (error) {
      console.warn('Failed to save message ID mappings to localStorage:', error);
    }
  };
  
  // Persist blank answers to localStorage when they change
  useEffect(() => {
    saveBlankAnswersToStorage(blankAnswers);
  }, [blankAnswers]);
  
  // Persist message ID mappings to localStorage when they change
  useEffect(() => {
    saveMessageIdMappingsToStorage(messageIdMappings);
  }, [messageIdMappings]);
  
  // Function to clear stored blank answers and phase state (for new adventures)
  const clearStoredBlankAnswers = () => {
    setBlankAnswers({});
    setMessageIdMappings({});
    setCurrentPhase('chat');
    setPhaseProgress(0);
    setTotalInteractions(0);
    try {
      localStorage.removeItem(BLANK_ANSWERS_STORAGE_KEY);
      localStorage.removeItem(MESSAGE_ID_MAPPING_STORAGE_KEY);
      localStorage.removeItem(PHASE_STATE_STORAGE_KEY);
      console.log('[DEBUG] Cleared all stored adventure progress');
    } catch (error) {
      console.warn('Failed to clear stored data from localStorage:', error);
    }
  };
  
  // State for managing hints for incorrect answers
  const [wordHints, setWordHints] = useState<Record<string, Record<number, string>>>({});
  
  // State for managing hint audio playback
  const [hintAudioLoading, setHintAudioLoading] = useState<Record<string, Record<number, boolean>>>({});
  const [hintAudioPlaying, setHintAudioPlaying] = useState<Record<string, Record<number, boolean>>>({});
  const [hintAudioInstances, setHintAudioInstances] = useState<Record<string, Record<number, HTMLAudioElement>>>({});

  // Function to toggle hint audio playback (play/pause)
  const toggleHintAudio = async (messageId: string, blankIndex: number, hintText: string) => {
    try {
      const existingAudio = hintAudioInstances[messageId]?.[blankIndex];
      
      // If audio exists and is playing, pause it
      if (existingAudio && !existingAudio.paused) {
        existingAudio.pause();
        setHintAudioPlaying(prev => ({
          ...prev,
          [messageId]: { ...prev[messageId], [blankIndex]: false }
        }));
        return;
      }
      
      // If audio exists and is paused, restart from beginning
      if (existingAudio && existingAudio.paused && existingAudio.currentTime > 0) {
        existingAudio.currentTime = 0; // Reset to beginning
        existingAudio.play();
        setHintAudioPlaying(prev => ({
          ...prev,
          [messageId]: { ...prev[messageId], [blankIndex]: true }
        }));
        return;
      }

      // Otherwise, create new audio
      setHintAudioLoading(prev => ({
        ...prev,
        [messageId]: { ...prev[messageId], [blankIndex]: true }
      }));

      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: hintText,
          voice_id: 'cgSgspJ2msm6clMCkdW9', // Jessica voice
          speed: 0.8
        })
      });

      if (!response.ok) throw new Error('Failed to generate audio');
      
      const data = await response.json();
      
      // Create and configure audio
      const audio = new Audio(data.audioUrl);
      
      // Store audio instance
      setHintAudioInstances(prev => ({
        ...prev,
        [messageId]: { ...prev[messageId], [blankIndex]: audio }
      }));

      audio.onended = () => {
        setHintAudioPlaying(prev => ({
          ...prev,
          [messageId]: { ...prev[messageId], [blankIndex]: false }
        }));
      };

      audio.onerror = () => {
        setHintAudioPlaying(prev => ({
          ...prev,
          [messageId]: { ...prev[messageId], [blankIndex]: false }
        }));
      };

      audio.onpause = () => {
        setHintAudioPlaying(prev => ({
          ...prev,
          [messageId]: { ...prev[messageId], [blankIndex]: false }
        }));
      };

      audio.onplay = () => {
        setHintAudioPlaying(prev => ({
          ...prev,
          [messageId]: { ...prev[messageId], [blankIndex]: true }
        }));
      };

      await audio.play();
    } catch (error) {
      console.error('Error with hint audio:', error);
    } finally {
      // Clear loading state
      setHintAudioLoading(prev => ({
        ...prev,
        [messageId]: { ...prev[messageId], [blankIndex]: false }
      }));
    }
  };

  // Function to generate AI hint for incorrect spelling
  const generateHintForWord = async (word: string, userAttempt: string) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a helpful spelling tutor for children aged 8-14. A student is trying to spell a word but got it wrong. Your job is to:

1. First, explain why their attempt doesn't match the target word
2. Give them 2-3 alternative options to consider (including the correct answer mixed in)
3. Strictly ensure the answer isn't directly mentioned in your hint.

The target word: "${word}"
Student's attempt: "${userAttempt}"

Format your response like this:
"Ah, that sounds like '${userAttempt}' which is [explanation]. Here are some options to try: [2-3 choices including correct answer]."

Keep it within 20 words. Keep it encouraging and focus on the learning process rather than giving away the answer.`
            },
            {
              role: 'user',
              content: `Help me spell "${word}". I tried "${userAttempt}" but it's wrong.`
            }
          ]
        })
      });

      if (!response.ok) throw new Error('Failed to generate hint');
      
      const data = await response.json();
      return data.reply || `Try thinking about the sounds in "${word}" - you're close!`;
    } catch (error) {
      console.error('Error generating hint:', error);
      return `Try thinking about the sounds in "${word}" - you're close!`;
    }
  };

  // Helper function to parse fill-in-the-blank messages
  const parseFillInTheBlanks = (text: string) => {
    // Match patterns like [BLANK], [BLANK:word], ___word___, or just ___
    const blankPattern = /(\[BLANK(?::[^\]]+)?\]|_{3,}[a-zA-Z]*_{3,}|_{3,})/g;
    const parts: Array<{ type: 'text' | 'blank', content: string, answer?: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = blankPattern.exec(text)) !== null) {
      // Add text before the blank
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.slice(lastIndex, match.index)
        });
      }

      // Extract answer hint if present (e.g., [BLANK:cake] -> "cake")
      const blankText = match[0];
      let answerHint = '';
      if (blankText.startsWith('[BLANK:')) {
        answerHint = blankText.slice(7, -1); // Remove [BLANK: and ]
      } else if (blankText.includes('___') && blankText.length > 3) {
        // Extract word from ___word___
        answerHint = blankText.replace(/_{3,}/g, '');
      }

      parts.push({
        type: 'blank',
        content: blankText,
        answer: answerHint
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex)
      });
    }

    return parts;
  };

  // Helper function to generate stable message ID based on content only
  const generateStableMessageId = (text: string, index: number) => {
    // Create a hash of the message text to ensure stability
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    const baseId = `msg-${Math.abs(hash)}`;
    
    // Check if we already have a mapping for this exact text
    const existingMapping = Object.entries(messageIdMappings).find(([key, value]) => key === text);
    if (existingMapping) {
      console.log(`[DEBUG] Using existing stable message ID: ${existingMapping[1]} for text: "${text.substring(0, 50)}..."`);
      return existingMapping[1];
    }
    
    // For new messages, check if this base ID already exists
    let finalId = baseId;
    let counter = 0;
    const existingIds = Object.values(messageIdMappings);
    
    while (existingIds.includes(finalId)) {
      counter++;
      finalId = `${baseId}-${counter}`;
    }
    
    // Store the mapping for future use
    setMessageIdMappings(prev => ({
      ...prev,
      [text]: finalId
    }));
    
    console.log(`[DEBUG] Generated new stable message ID: ${finalId} for text: "${text.substring(0, 50)}..." (counter: ${counter})`);
    return finalId;
  };

  // Helper function to get complete text with filled blanks for audio
  const getCompleteTextForAudio = (text: string, messageId: string) => {
    const parts = parseFillInTheBlanks(text);
    let completeText = '';
    let blankIndex = 0;

    parts.forEach(part => {
      if (part.type === 'text') {
        completeText += part.content;
      } else {
        // Use the target word (correct answer) for audio, not user's input
        const audioText = part.answer || 'blank';
        completeText += audioText;
        blankIndex++;
      }
    });

    return completeText;
  };

  // Component to render fill-in-the-blank message
  const FillInTheBlankMessage: React.FC<{ 
    text: string; 
    messageId: string; 
    onAnswerChange: (blankIndex: number, answer: string) => void;
    onSpellingComplete?: (isComplete: boolean) => void;
  }> = ({ text, messageId, onAnswerChange, onSpellingComplete }) => {
    const parts = parseFillInTheBlanks(text);
    console.log(`[DEBUG] FillInTheBlankMessage - Text: "${text}", Parsed parts:`, parts);
    const initialFocusRef = React.useRef<boolean>(false);
    
    // Function to check if word is spelled correctly
    const isWordCorrect = (userWord: string, expectedWord: string) => {
      return userWord.replace(/ /g, '').toUpperCase() === expectedWord.toUpperCase();
    };

    // Function to check if word is complete (all letters filled)
    const isWordComplete = (userWord: string, expectedLength: number) => {
      return userWord.length === expectedLength && userWord.replace(/ /g, '').length === expectedLength;
    };

    // Function to check if word is incorrect (complete but wrong spelling)
    const isWordIncorrect = (userWord: string, expectedWord: string, expectedLength: number) => {
      return isWordComplete(userWord, expectedLength) && !isWordCorrect(userWord, expectedWord);
    };

    // Function to find next empty letter box across all words
    const focusNextEmptyBox = () => {
      // Find all letter inputs in order
      const allInputs = Array.from(document.querySelectorAll('input[data-letter]')) as HTMLInputElement[];
      
      // Sort inputs by their data-letter attribute to ensure correct order
      allInputs.sort((a, b) => {
        const aData = a.getAttribute('data-letter') || '';
        const bData = b.getAttribute('data-letter') || '';
        return aData.localeCompare(bData);
      });
      
      // Find first empty input
      for (let input of allInputs) {
        if (!input.value.trim()) {
          setTimeout(() => {
            input.focus();
            // Removed scrollIntoView to prevent auto-scroll when new questions appear
          }, 10);
          return true;
        }
      }
      return false; // No empty boxes found
    };

    // Function to focus the very first letter box (for initial load)
    const focusFirstBox = () => {
      const firstInput = document.querySelector('input[data-letter="0-0"]') as HTMLInputElement;
      if (firstInput) {
        setTimeout(() => {
          firstInput.focus();
          // Removed scrollIntoView to prevent auto-scroll when new questions appear
        }, 150); // Slightly longer delay for initial load
      }
    };

    // Function to play individual word audio with context
    const playWordAudio = async (word: string, blankIndex: number) => {
      try {
        // Get context around the target word from the original message
        let contextText = word; // Fallback to just the word
        
        // Try to extract context from the original message text
        const fullText = text.replace(/\[BLANK(?::[^\]]+)?\]/g, word).replace(/\*/g, ''); // Replace blank with actual word and remove asterisks
        const words = fullText.split(/\s+/).filter(w => w.trim()); // Split into words
        
        // Find the target word in the text
        const targetWordIndex = words.findIndex(w => 
          w.toLowerCase().replace(/[^\w]/g, '') === word.toLowerCase()
        );
        
        if (targetWordIndex !== -1) {
          // Extract 2 words before and 2 words after (5 words total including target)
          const startIndex = Math.max(0, targetWordIndex);
          const endIndex = Math.min(words.length, targetWordIndex + 3);
          const contextWords = words.slice(startIndex, endIndex);
          contextText = contextWords.join(' ');
          console.log(`Playing target word "${word}" with context: "${contextText}"`);
        }
        
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: contextText }) // Remove speed from API call
        });
        const data = await response.json();
        if (data.audioUrl) {
          const audio = new Audio(data.audioUrl);
          audio.playbackRate = 0.75; // Set playback rate on client side for slower speed
          audio.play();
        }
      } catch (error) {
        console.error('Error playing word audio:', error);
      }
    };

    // If no blanks found, render as regular text and allow input
    if (parts.every(part => part.type === 'text')) {
      // Notify parent that there's no spelling task, so input should be enabled
      React.useEffect(() => {
        if (onSpellingComplete) {
          onSpellingComplete(true);
        }
      }, [onSpellingComplete]);

      return (
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 18, fontWeight: 500, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {text}
        </span>
      );
    }

    // Count total blanks and correctly spelled words
    const totalBlanks = parts.filter(part => part.type === 'blank').length;
    const correctlySpelledWords = parts.filter(part => part.type === 'blank').filter((part, index) => {
      const userAnswer = blankAnswers[messageId]?.[index] || '';
      return isWordComplete(userAnswer, part.answer?.length || 5) && 
             isWordCorrect(userAnswer, part.answer || '');
    }).length;

    // Check if all spelling is complete (all words correctly spelled)
    const isSpellingComplete = totalBlanks > 0 && correctlySpelledWords === totalBlanks;

    // Notify parent component about spelling completion status
    React.useEffect(() => {
      if (onSpellingComplete) {
        onSpellingComplete(isSpellingComplete);
      }
      
      // Award coins when spelling is completed for the first time
      if (isSpellingComplete && totalBlanks > 0) {
        const completionKey = `spelling_completed_${messageId}`;
        const hasBeenRewarded = localStorage.getItem(completionKey);
        
        if (!hasBeenRewarded) {
          // Award 10 coins per correctly spelled word
          const coinsEarned = totalBlanks * 10;
          addCoins(coinsEarned);
          localStorage.setItem(completionKey, 'true');
          
          // Show a brief notification (optional)
          console.log(`🎉 Earned ${coinsEarned} coins for spelling correctly!`);
        }
      }
    }, [isSpellingComplete, onSpellingComplete, totalBlanks, messageId, addCoins]);

    let blankIndex = 0;

    // Auto-focus management - single effect to avoid conflicts
    React.useEffect(() => {
      // Only do initial focus once per message
      if (!initialFocusRef.current) {
        initialFocusRef.current = true;
        
        // Check if this is truly the initial state (no answers at all)
        const hasAnyAnswers = Object.values(blankAnswers[messageId] || {}).some(answer => answer.trim() !== '');
        
        if (!hasAnyAnswers && correctlySpelledWords === 0) {
          // Initial load - focus first box
          focusFirstBox();
        } else {
          // Has some progress - focus next empty box
          focusNextEmptyBox();
        }
      }
    }, [messageId]); // Only run when messageId changes (component mount/new message)

    // Reset the focus ref when messageId changes
    React.useEffect(() => {
      initialFocusRef.current = false;
    }, [messageId]);

    return (
      <div style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 18, fontWeight: 500, lineHeight: 1.6 }}>
        {/* Progress indicator ribbon */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          marginBottom: '16px',
          padding: '8px 12px',
          background: 'linear-gradient(135deg, #F8F5FF 0%, #EDE9FE 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          animation: 'fadeSlideIn 0.3s ease-out'
        }}>
          <span style={{ fontSize: '16px' }}>👂</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#6B46C1' }}>
            {correctlySpelledWords === totalBlanks ? 'Word spelled correctly! 🎉' : 
             correctlySpelledWords === 0 ? `Listen and spell the word` : 
             `${totalBlanks - correctlySpelledWords} word left`}
          </span>
        </div>

        {/* Hints for incorrect words */}
        {parts.filter(part => part.type === 'blank').some((part, index) => {
          const hint = wordHints[messageId]?.[index];
          return hint && hint.trim() !== '';
        }) && (
          <div style={{
            background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            border: '1px solid #F59E0B',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeSlideIn 0.3s ease-out',
            position: 'relative'
          }}>
            <span style={{ fontSize: '16px' }}>💡</span>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#92400E', lineHeight: 1.4, flex: 1 }}>
              {parts.filter(part => part.type === 'blank').map((part, index) => {
                const hint = wordHints[messageId]?.[index];
                return hint && hint.trim() !== '' ? (
                  <div key={index} style={{ marginBottom: index < parts.filter(p => p.type === 'blank').length - 1 ? '8px' : '0' }}>
                    <strong>Hint:</strong> {hint}
                  </div>
                ) : null;
              }).filter(Boolean)}
            </div>
            {/* Speaker button for hint audio */}
            {parts.filter(part => part.type === 'blank').some((part, index) => {
              const hint = wordHints[messageId]?.[index];
              return hint && hint.trim() !== '';
            }) && (
              <button
                onClick={() => {
                  const firstHintIndex = parts.findIndex((part, index) => {
                    if (part.type !== 'blank') return false;
                    const blankIndex = parts.slice(0, index + 1).filter(p => p.type === 'blank').length - 1;
                    const hint = wordHints[messageId]?.[blankIndex];
                    return hint && hint.trim() !== '';
                  });
                  
                  if (firstHintIndex !== -1) {
                    const blankIndex = parts.slice(0, firstHintIndex + 1).filter(p => p.type === 'blank').length - 1;
                    const hint = wordHints[messageId]?.[blankIndex];
                    if (hint) {
                      toggleHintAudio(messageId, blankIndex, hint);
                    }
                  }
                }}
                disabled={Object.values(hintAudioLoading[messageId] || {}).some(loading => loading)}
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  background: Object.values(hintAudioPlaying[messageId] || {}).some(playing => playing) 
                    ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' 
                    : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: Object.values(hintAudioLoading[messageId] || {}).some(loading => loading) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  color: 'white',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s ease',
                  opacity: Object.values(hintAudioLoading[messageId] || {}).some(loading => loading) ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!Object.values(hintAudioLoading[messageId] || {}).some(loading => loading)) {
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {Object.values(hintAudioLoading[messageId] || {}).some(loading => loading) ? (
                  <div style={{
                    width: '10px',
                    height: '10px',
                    border: '2px solid transparent',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                ) : Object.values(hintAudioPlaying[messageId] || {}).some(playing => playing) ? (
                  '⏸️'
                ) : (
                  '🔊'
                )}
              </button>
            )}
          </div>
        )}

        {/* Message with inline input blanks */}
        <div 
          style={{ color: '#111827', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}
          onClick={(e) => {
            // If user clicks in the message area but not on an input, focus next empty box
            if (e.target === e.currentTarget) {
              focusNextEmptyBox();
            }
          }}
        >
          {parts.map((part, partIndex) => {
            if (part.type === 'text') {
              return (
                <span key={partIndex} style={{ whiteSpace: 'pre-wrap' }}>
                  {part.content}
                </span>
              );
            } else {
              const currentBlankIndex = blankIndex++;
              const currentAnswer = blankAnswers[messageId]?.[currentBlankIndex] || '';
              const expectedLength = part.answer?.length || 5; // Use hint length or default to 5
              
              return (
                <span key={partIndex} style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  position: 'relative'
                }}>
                  {/* Letter boxes for each character */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '3px',
                    alignItems: 'center'
                  }}>
                    {Array.from({ length: expectedLength }, (_, letterIndex) => {
                      const rawLetterValue = currentAnswer[letterIndex] || ' ';
                      const letterValue = rawLetterValue === ' ' ? '' : rawLetterValue;
                      const isWordCompleteNow = isWordComplete(currentAnswer, expectedLength);
                      const isWordCorrectNow = isWordCompleteNow && isWordCorrect(currentAnswer, part.answer || '');
                      const isWordIncorrectNow = isWordIncorrect(currentAnswer, part.answer || '', expectedLength);
                      
                      // Determine styling based on word completion and correctness
                      let boxStyle: React.CSSProperties = {
                        width: '28px',
                        height: '32px',
                        padding: '0',
                        borderRadius: '6px',
                        fontSize: '16px',
                        fontFamily: 'Quicksand, sans-serif',
                        fontWeight: '700',
                        textAlign: 'center',
                        outline: 'none',
                        transition: 'all 0.3s ease',
                        textTransform: 'uppercase'
                      };

                      if (isWordCorrectNow) {
                        // Correct spelling - green theme with disabled cursor
                        boxStyle = {
                          ...boxStyle,
                          background: '#DCFCE7', // Light green
                          border: '2px solid #16A34A', // Green border
                          color: '#15803D', // Dark green text
                          boxShadow: '0 2px 8px rgba(22, 163, 74, 0.2)',
                          cursor: 'not-allowed', // Show disabled cursor
                          opacity: 0.8 // Slightly faded to show it's locked
                        };
                      } else if (isWordIncorrectNow) {
                        // Incorrect spelling - red theme
                        boxStyle = {
                          ...boxStyle,
                          background: '#FEE2E2', // Light red
                          border: '2px solid #DC2626', // Red border
                          color: '#B91C1C', // Dark red text
                          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.2)'
                        };
                      } else if (letterValue) {
                        // Has letter but word not complete - blue theme
                        boxStyle = {
                          ...boxStyle,
                          background: '#E0F2FE',
                          border: '2px solid #0369A1',
                          color: '#0369A1'
                        };
                      } else {
                        // Empty box - neutral theme
                        boxStyle = {
                          ...boxStyle,
                          background: 'rgba(255, 255, 255, 0.9)',
                          border: '2px solid #D1D5DB',
                          color: '#64748B'
                        };
                      }
                      
                      return (
                        <input
                          key={letterIndex}
                          type="text"
                          value={letterValue}
                          maxLength={1}
                          disabled={isWordCorrectNow} // Disable input when word is correctly spelled
                          onChange={async (e) => {
                            // Prevent changes if word is already correct
                            if (isWordCorrectNow) return;
                            
                            const newValue = e.target.value.toUpperCase();
                            if (newValue.match(/[A-Z]/) || newValue === '') {
                              // Update the word by replacing the character at this position
                              const newWord = Array.from({ length: expectedLength }, (_, i) => 
                                i === letterIndex ? newValue : (currentAnswer[i] || ' ')
                              );
                              const finalWord = newWord.join('').replace(/ /g, ' '); // Use space as placeholder
                              onAnswerChange(currentBlankIndex, finalWord);
                              
                              // Check if word is complete and incorrect to generate hint
                              if (isWordComplete(finalWord, expectedLength) && !isWordCorrect(finalWord, part.answer || '')) {
                                // Always generate a new hint for each incorrect complete word attempt
                                const hint = await generateHintForWord(part.answer || '', finalWord);
                                setWordHints(prev => ({
                                  ...prev,
                                  [messageId]: {
                                    ...prev[messageId],
                                    [currentBlankIndex]: hint
                                  }
                                }));
                                
                                // Clear any existing audio instance so new hint audio can be generated
                                setHintAudioInstances(prev => {
                                  const newState = { ...prev };
                                  if (newState[messageId]) {
                                    const { [currentBlankIndex]: _, ...rest } = newState[messageId];
                                    newState[messageId] = rest;
                                  }
                                  return newState;
                                });
                              } else if (isWordCorrect(finalWord, part.answer || '')) {
                                // Clear hint when word becomes correct
                                setWordHints(prev => ({
                                  ...prev,
                                  [messageId]: {
                                    ...prev[messageId],
                                    [currentBlankIndex]: ''
                                  }
                                }));
                              }
                              
                              // Auto-advance logic
                              if (newValue) {
                                if (letterIndex < expectedLength - 1) {
                                  // Move to next letter in same word
                                  const nextBox = document.querySelector(`input[data-letter="${currentBlankIndex}-${letterIndex + 1}"]`) as HTMLInputElement;
                                  if (nextBox) {
                                    setTimeout(() => nextBox.focus(), 10);
                                  }
                                } else {
                                  // Last letter of current word - check if word is complete and move to next empty box
                                  const updatedWord = finalWord;
                                  if (isWordComplete(updatedWord, expectedLength)) {
                                    // Word is complete, move to next empty box anywhere
                                    setTimeout(() => {
                                      if (!focusNextEmptyBox()) {
                                        // No more empty boxes - all words might be complete
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }, 50); // Slightly longer delay to prevent conflicts
                                  }
                                }
                              }
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace') {
                              if (letterValue) {
                                // If current box has a letter, clear it and stay in same position
                                e.preventDefault(); // Prevent default backspace behavior
                                const newWord = Array.from({ length: expectedLength }, (_, i) => 
                                  i === letterIndex ? ' ' : (currentAnswer[i] || ' ')
                                );
                                const finalWord = newWord.join(''); // Use space as placeholder
                                onAnswerChange(currentBlankIndex, finalWord);
                              } else if (letterIndex > 0) {
                                // If current box is empty, move to previous box
                                const prevBox = document.querySelector(`input[data-letter="${currentBlankIndex}-${letterIndex - 1}"]`) as HTMLInputElement;
                                if (prevBox) {
                                  prevBox.focus();
                                }
                              }
                            } else if (e.key === 'ArrowLeft' && letterIndex > 0) {
                              const prevBox = document.querySelector(`input[data-letter="${currentBlankIndex}-${letterIndex - 1}"]`) as HTMLInputElement;
                              if (prevBox) prevBox.focus();
                            } else if (e.key === 'ArrowRight' && letterIndex < expectedLength - 1) {
                              const nextBox = document.querySelector(`input[data-letter="${currentBlankIndex}-${letterIndex + 1}"]`) as HTMLInputElement;
                              if (nextBox) nextBox.focus();
                            } else if (e.key === 'Enter') {
                              // Move to next word's first letter
                              const nextWordFirstBox = document.querySelector(`input[data-letter="${currentBlankIndex + 1}-0"]`) as HTMLInputElement;
                              if (nextWordFirstBox) {
                                e.preventDefault();
                                nextWordFirstBox.focus();
                              }
                            }
                          }}
                          style={boxStyle}
                          onFocus={(e) => {
                            // Don't allow focus if word is correct
                            if (isWordCorrectNow) {
                              e.target.blur();
                              return;
                            }
                            if (!isWordCorrectNow && !isWordIncorrectNow) {
                              e.target.style.borderColor = '#3B82F6';
                              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)';
                            }
                            e.target.style.transform = 'scale(1.05)';
                          }}
                          onBlur={(e) => {
                            // Restore original styling based on state
                            const hasValue = e.target.value.trim() !== '';
                            const isCorrectNow = isWordComplete(currentAnswer, expectedLength) && isWordCorrect(currentAnswer, part.answer || '');
                            const isIncorrectNow = isWordIncorrect(currentAnswer, part.answer || '', expectedLength);
                            
                            if (isCorrectNow) {
                              e.target.style.borderColor = '#16A34A';
                              e.target.style.boxShadow = '0 2px 8px rgba(22, 163, 74, 0.2)';
                            } else if (isIncorrectNow) {
                              e.target.style.borderColor = '#DC2626';
                              e.target.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.2)';
                            } else if (hasValue) {
                              e.target.style.borderColor = '#0369A1';
                              e.target.style.boxShadow = 'none';
                            } else {
                              e.target.style.borderColor = '#D1D5DB';
                              e.target.style.boxShadow = 'none';
                            }
                            e.target.style.transform = 'scale(1)';
                          }}
                          data-letter={`${currentBlankIndex}-${letterIndex}`}
                        />
                      );
                    })}
                  </div>
                  
                  {/* Subtle word audio button */}
                  <button
                    onClick={() => playWordAudio(part.answer || '', currentBlankIndex)}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #E5E7EB 0%, #D1D5DB 100%)',
                      color: '#6B7280',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      transition: 'all 0.15s ease',
                      opacity: 0.7,
                      transform: 'scale(1)'
                    }}
                    title="Listen to this word"
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                      (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
                      (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.opacity = '0.7';
                      (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                      (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #E5E7EB 0%, #D1D5DB 100%)';
                      (e.currentTarget as HTMLButtonElement).style.color = '#6B7280';
                    }}
                  >
                    🔊
                  </button>
                </span>
              );
            }
          })}
        </div>

        {/* CSS animations */}
        <style>{`
          @keyframes fadeSlideIn {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes sparkle {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          
          @keyframes equalizer {
            0% { transform: scaleY(0.4); }
            100% { transform: scaleY(1); }
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  };

  // Sync adventure context with story metadata for QuestionPanel image generation
  useEffect(() => {
    setMetadata({
      protagonist: currentAdventure.protagonist,
      sidekick: currentAdventure.sidekick,
      setting: currentAdventure.setting,
      goal: currentAdventure.goal
    });
  }, [currentAdventure, setMetadata]);

  // Helper function to analyze responses and update adventure state
  const updateAdventureContext = (userMessage: string, aiResponse: string) => {
    const lowerUser = userMessage.toLowerCase();
    const lowerAI = aiResponse.toLowerCase();
    
    // Check for interest-based adventure selection
          const interests = ['gaming', 'roblox', 'digital', 'battle', 'adventure', 'heroic', 'forest', 'technology', 'shadow', 'magic', 'robot', 'epic', 'futuristic'];
    const selectedInterest = interests.find(interest => lowerUser.includes(interest));
    
    if (selectedInterest && adventureState === 'new') {
      setCurrentAdventure(prev => ({ ...prev, type: selectedInterest }));
      setAdventureState('ongoing');
    }
    
    // Check for character creation keywords
    if (lowerUser.includes('create') && (lowerUser.includes('character') || lowerUser.includes('sidekick'))) {
      setAdventureState('character_creation');
    }
    
    // Check for adventure progression
    if (adventureState === 'new' && lowerUser.length > 10) {
      setAdventureState('ongoing');
    }
    
    // Parse potential character/adventure elements from user input
    if (lowerUser.includes('name') && adventureState === 'character_creation') {
      // Extract potential names or update sidekick name
      const words = userMessage.split(' ');
      const nameIndex = words.findIndex(w => w.toLowerCase() === 'name');
      if (nameIndex >= 0 && nameIndex < words.length - 1) {
        setCurrentAdventure(prev => ({ ...prev, sidekick: words[nameIndex + 1] }));
      }
    }
  };

  // Track previous message count to only auto-scroll on new messages
  const prevMessageCountRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  
  useEffect(() => {
    const node = adventureScrollRef.current;
    if (!node) return;
    
    // Only auto-scroll if a new message was added (not just updated)
    const currentMessageCount = adventureMessages.length;
    const isNewMessage = currentMessageCount > prevMessageCountRef.current;
    
    // Check if user is actively typing in spelling inputs
    const activeElement = document.activeElement;
    const isTypingInSpelling = activeElement && activeElement.getAttribute('data-letter');
    
    // Check if user has manually scrolled up recently (within last 5 seconds)
    const now = Date.now();
    const hasRecentManualScroll = (now - lastScrollTimeRef.current) < 5000;
    const isNearBottom = node.scrollTop > (node.scrollHeight - node.clientHeight - 100);
    
    // Auto-scroll conditions:
    // 1. New message was added
    // 2. User is not actively typing in spelling inputs
    // 3. User hasn't manually scrolled up recently OR user is near the bottom
    const shouldAutoScroll = isNewMessage && !isTypingInSpelling && (!hasRecentManualScroll || isNearBottom);
    
    if (shouldAutoScroll) {
      console.log('[DEBUG] Auto-scrolling to latest message');
      requestAnimationFrame(() => {
        node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
      });
    }
    
    prevMessageCountRef.current = currentMessageCount;
  }, [adventureMessages]);
  
  // Track manual scroll events to prevent auto-scroll when user is reading older messages
  useEffect(() => {
    const node = adventureScrollRef.current;
    if (!node) return;
    
    const handleScroll = () => {
      const isNearBottom = node.scrollTop > (node.scrollHeight - node.clientHeight - 100);
      if (!isNearBottom) {
        lastScrollTimeRef.current = Date.now();
      }
    };
    
    node.addEventListener('scroll', handleScroll, { passive: true });
    return () => node.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Force scroll to bottom function (for initial load and when needed)
  const forceScrollToBottom = React.useCallback(() => {
    const node = adventureScrollRef.current;
    if (node) {
      console.log('[DEBUG] Force scrolling to bottom');
      requestAnimationFrame(() => {
        node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
      });
    }
  }, []);
  
  // Scroll to bottom on initial load
  useEffect(() => {
    if (adventureMessages.length > 0) {
      // Small delay to ensure DOM is rendered
      setTimeout(forceScrollToBottom, 100);
    }
  }, []); // Only run once on mount

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const markGesture = () => { hasUserGestureRef.current = true; };
    window.addEventListener('pointerdown', markGesture, { once: true });
    window.addEventListener('keydown', markGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', markGesture as () => void);
      window.removeEventListener('keydown', markGesture as () => void);
      // Ensure audio stops when component unmounts
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      } catch {}
      try { audioManager.stopAll(); } catch {}
    };
  }, []);

  useEffect(() => {
    // If arriving from Step 5 with a pending chat, inject it once
    const pending = consumePendingAdventureChat?.();
    if (pending && pending.text) {
      // Drive the normal send path to avoid duplicate appends
      setAdventureInput(pending.text);
      scrollInputToEnd();
      setTimeout(() => { void sendAdventureMessage(); }, 50);
    }

    const latestMessage = adventureMessages[adventureMessages.length - 1];
    const latestIndex = adventureMessages.length - 1;
    if (
      latestMessage &&
      latestMessage.role === 'ai' &&
      !latestMessage.isLoading &&
      !latestMessage.isImage &&
      !autoPlayedMessages.has(latestIndex) &&
      latestMessage.text.trim()
    ) {
      setAutoPlayedMessages(prev => new Set([...prev, latestIndex]));
      setTimeout(() => {
        void playAIResponse(latestIndex, latestMessage.text);
      }, 500);
    }
  }, [adventureMessages, autoPlayedMessages]);

  const generateAdventureImage = async () => {
    const text = adventureInput.trim();
    if (!text) return;

    // Get conversation history for weighted prompt generation (last 6 messages - OpenAI style)
    const conversationHistory = getLastConversationMessages();
    
    // Generate OpenAI-style weighted prompt: 85% anchor on current request, 15% light context
    const weightedContent = generateWeightedPrompt(text, conversationHistory);
    
    // Build comprehensive context-aware prompt with weighted user messages
    const storyEventsContext = storyState?.storyEvents?.length > 0 
      ? storyState.storyEvents.slice(-8).join('. ')
      : '';
    
    // Build the main image prompt using weighted user message history
    const contextParts = [];
    contextParts.push(weightedContent);
    contextParts.push('Remove moderated parts from the image if present, and create it.');
    
    // Story setting comes first for context
    // if (currentAdventure?.setting) {
    //   contextParts.push(`ADVENTURE SETTING(just use this as the background): ${currentAdventure.setting}`);
    // }
    
    // Add weighted user message context (this is the core of the prompt)
    
    
    // Add recent story events for additional context
    // if (storyEventsContext) {
    //   contextParts.push(`Additional story context(just use this as the background): ${storyEventsContext}`);
    // }
    
    // Construct the main image prompt that will be sent to image.ts
    const mainimageprompt = contextParts.join('. ');
    
    // Use mainimageprompt as the final prompt that goes to the API
    
    let imagePrompt = mainimageprompt;
    // Log weighted adventure image generation
    console.log('=== ADVENTURE MODE 2 WEIGHTED IMAGE GENERATION ===');
    console.log('Function: AdventureMode2.generateAdventureImage');
          console.log('Current input text:', text);
      console.log('Conversation history (last 6 - OpenAI style):', conversationHistory);
      console.log('OpenAI-style weighted content (85% anchor, 15% context):', weightedContent);
    console.log('Story setting:', currentAdventure?.setting);
    console.log('Final mainimageprompt sent to image.ts:', mainimageprompt);
    console.log('================================================');

    updateAdventureMessages(prev => [...prev, { role: 'student', text: `🌄 Create image: ${text}` }]);
    appendStoryMessage({ role: 'student', text: `🌄 Create image: ${text}` });
    setAdventureInput('');
    // Increment user message counter for image generation too
    setUserMessageCount(prev => prev + 1);
    updateAdventureMessages(prev => [...prev, { role: 'ai', text: 'Creating your image...', isLoading: true }]);
    
    // Force scroll to bottom after adding messages
    setTimeout(forceScrollToBottom, 100);

    try {
      const response = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt })
      });
      const data = await response.json();
      if (response.ok && data.imageUrl) {
        updateAdventureMessages(prev => {
          const newMessages = [...prev];
          const loadingIndex = newMessages.findIndex(m => m.isLoading);
          if (loadingIndex !== -1) {
            newMessages[loadingIndex] = {
              role: 'ai',
              text: "Here's your image! 🌄✨",
              isImage: true,
              imageUrl: data.imageUrl,
              isLoading: false
            };
          }
          return newMessages;
        });
        setFullscreenImageUrl(data.imageUrl);
        appendStoryMessage({ role: 'ai', text: "Here's your adventure image! 🌄✨", isImage: true, imageUrl: data.imageUrl });
        setShowFullscreenImage(true);
      } else {
        throw new Error(data.error || 'Failed to generate image');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      updateAdventureMessages(prev => {
        const newMessages = [...prev];
        const loadingIndex = newMessages.findIndex(m => m.isLoading);
        if (loadingIndex !== -1) {
          newMessages[loadingIndex] = {
            role: 'ai',
            text: "Sorry, I couldn't create that image. Please try again with a different description! 🌄",
            isLoading: false
          };
        }
        return newMessages;
      });
      appendStoryMessage({ role: 'ai', text: "Sorry, I couldn't create that image. Please try again with a different description! 🌄" });
    }
  };

  const playAIResponse = async (messageIndex: number, text: string) => {
    try {
      // Get complete text with filled blanks for audio
      const completeText = getCompleteTextForAudio(text, `msg-${messageIndex}`);
      const cleanText = completeText.replace(/[🎉🚀🌙🌄✨😊]/g, '').replace(/\*/g, '').trim();
      // If this same message is already playing, treat this call as a toggle to stop
      const active = audioManager.getActive?.() as HTMLAudioElement | null;
      if (active && currentAdventureAudioLabelRef.current === cleanText && !active.paused && !active.ended) {
        try { active.pause(); active.currentTime = 0; } catch {}
        currentAdventureAudioLabelRef.current = null;
        setPlayingAudio(prev => prev === messageIndex ? null : prev);
        return;
      }
      // Ensure only one audio plays at a time globally
      audioManager.stopAll();
      setAudioLoading(messageIndex);
      if (!cleanText) {
        setAudioLoading(null);
        return;
      }
      let audioUrl = audioCacheRef.current.get(cleanText);
      if (!audioUrl) {
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText, speed: 1.0 }) // Normal speed for adventure content
        });
        if (!response.ok) {
          let upstream = 'unknown';
          try { upstream = await response.text(); } catch {}
          throw new Error(`TTS API error: ${response.status} ${upstream}`);
        }
        const data = await response.json();
        audioUrl = data.audioUrl as string | undefined;
        if (audioUrl) audioCacheRef.current.set(cleanText, audioUrl);
      }
      if (audioUrl) {
        setAudioLoading(null);
        setPlayingAudio(messageIndex);
        const audio = audioRef.current ?? new Audio();
        audioRef.current = audio;
        audio.src = audioUrl;
        currentAdventureAudioLabelRef.current = cleanText;
        audio.onended = () => {
          setPlayingAudio(prev => prev === messageIndex ? null : prev);
          if (currentAdventureAudioLabelRef.current === cleanText) currentAdventureAudioLabelRef.current = null;
        };
        audio.onerror = () => {
          setPlayingAudio(prev => prev === messageIndex ? null : prev);
          if (currentAdventureAudioLabelRef.current === cleanText) currentAdventureAudioLabelRef.current = null;
        };
        audio.onabort = () => {
          setPlayingAudio(prev => prev === messageIndex ? null : prev);
          if (currentAdventureAudioLabelRef.current === cleanText) currentAdventureAudioLabelRef.current = null;
        };
        audio.onpause = () => {
          setPlayingAudio(prev => prev === messageIndex ? null : prev);
          if (currentAdventureAudioLabelRef.current === cleanText) currentAdventureAudioLabelRef.current = null;
        };
        // Register as the active audio; this will stop any other playing audio
        audioManager.setActive(audio);
        try {
          if (!hasUserGestureRef.current) {
            const resumeOnGesture = () => {
              hasUserGestureRef.current = true;
              window.removeEventListener('pointerdown', resumeOnGesture);
              window.removeEventListener('keydown', resumeOnGesture);
              void audio.play().catch(err => {
                console.error('Deferred audio play failed:', err);
                setPlayingAudio(prev => prev === messageIndex ? null : prev);
                if (currentAdventureAudioLabelRef.current === cleanText) currentAdventureAudioLabelRef.current = null;
              });
            };
            window.addEventListener('pointerdown', resumeOnGesture, { once: true });
            window.addEventListener('keydown', resumeOnGesture, { once: true });
          } else {
            await audio.play();
          }
        } catch (playError) {
          console.error('Audio play failed:', playError);
          setPlayingAudio(prev => prev === messageIndex ? null : prev);
          if (currentAdventureAudioLabelRef.current === cleanText) currentAdventureAudioLabelRef.current = null;
        }
      } else {
        throw new Error('No audio URL returned');
      }
    } catch (error) {
      console.error('Error playing AI response:', error);
      setAudioLoading(prev => prev === messageIndex ? null : prev);
      setPlayingAudio(prev => prev === messageIndex ? null : prev);
    }
  };

  const toggleAIResponse = async (messageIndex: number, text: string) => {
    const cleanText = text.replace(/[🎉🚀🌙🌄✨😊]/g, '').replace(/\*/g, '').trim();
    const el = audioRef.current;
    const active = audioManager.getActive?.() as HTMLAudioElement | null;
    const isGlobalActiveThis = !!active && active === el && !active.paused && !active.ended;
    const isThisMessageActive = isGlobalActiveThis || currentAdventureAudioLabelRef.current === cleanText || (!!el && !el.paused && !el.ended && currentAdventureAudioLabelRef.current === cleanText);
    // If this exact message's audio is currently playing, stop it
    if (isThisMessageActive || playingAudio === messageIndex) {
      try {
        const toStop = active && active === el ? active : el;
        if (toStop) {
          toStop.pause();
          toStop.currentTime = 0;
          try { toStop.src = ''; toStop.load(); } catch {}
        }
      } catch {}
      currentAdventureAudioLabelRef.current = null;
      setPlayingAudio(null);
      audioManager.stopAll();
      return;
    }
    // Otherwise, play this message (will stop any other audio via audioManager)
    await playAIResponse(messageIndex, text);
  };

  // Enhanced function to detect image creation intent
  const detectImageIntent = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    
    // Direct image requests
    if (lowerText === 'image' || lowerText === 'create image' || lowerText.startsWith('create image')) {
      return true;
    }
    
    // Common image creation patterns
    const imagePatterns = [
      // Direct requests
      /^(make|create|generate|draw|show me?).*image/i,
      /^image.*(of|for|with|showing)/i,
      /^(can you|could you).*image/i,
      
      // Visual description requests
      /^(show|display|visualize|picture|illustrate)/i,
      /^what.*(look|appear|seem).*(like)/i,
      /^i want to see/i,
      /^let me see/i,
      
      // Scene description requests
      /^(imagine|picture|envision|visualize)/i,
      /(scene|scenery|setting|environment|landscape|view)/i,
      
      // "I see" or descriptive statements that imply visualization
      /^i see.*(with|in|at|near|around)/i,
      /^there (is|are|appears|stands|sits)/i,
      
      // Adventure-specific visual requests
      /(magical|enchanted|mystical|fantasy).*scene/i,
              /(roblox|digital|crater|robot|forest).*scene/i,
      /adventure.*scene/i,
      
      // Drawing/art requests
      /^(draw|sketch|paint|design)/i,
      /art.*(of|for|showing)/i
    ];
    
    return imagePatterns.some(pattern => pattern.test(lowerText));
  };

  const sendAdventureMessage = async () => {
    const text = adventureInput.trim();
    console.log('sendAdventureMessage called with text:', text);
    if (!text) return;

    // Check for image creation intent using enhanced detection
    if (detectImageIntent(text)) {
      console.log('Image intent detected, using generateAdventureImage flow');
      // Use the exact same flow as the 🌄 button
      await generateAdventureImage();
      return;
    }

    updateAdventureMessages(prev => [...prev, { role: 'student', text }]);
    appendStoryMessage({ role: 'student', text });
    onAdventureMessage?.(text);
    setAdventureInput('');
    
    // Force scroll to bottom after sending message
    setTimeout(forceScrollToBottom, 100);
    
    // Increment user message counter and total interactions
    setUserMessageCount(prev => prev + 1);
    const nextTotalInteractions = totalInteractions + 1;
    setTotalInteractions(nextTotalInteractions);
    
    // Reset accumulated speech recognition text after submission
    adventureAccumulatedRef.current = '';
    updateAdventureMessages(prev => [...prev, { role: 'ai', text: 'Thinking about your adventure...', isLoading: true }]);

    // Use AI-generated responses with dynamic blank insertion
    try {
      const currentMessages = adventureMessages.filter(m => !m.isLoading && !m.isImage);
      
      // Calculate phase info using the NEXT interaction count (after increment)
      // Use the same logic as getCurrentPhaseInfo() to ensure consistency
      const adjustedInteractions = Math.max(0, nextTotalInteractions - 1);
      const phaseIndex = Math.floor(adjustedInteractions / 3);
      const withinPhaseIndex = adjustedInteractions % 3;
      const isQuestionPhase = phaseIndex % 2 === 1; // Odd phases are question phases
      const phase = isQuestionPhase ? 'question' as const : 'chat' as const;
      
      // Update current phase tracking
      setCurrentPhase(phase);
      setPhaseProgress(withinPhaseIndex);
      
      // Select target words for question phases
      const targetWordsToUse = isQuestionPhase ? selectTargetWords(phaseIndex, withinPhaseIndex) : [];
      
      // Include story events for better context
      const storyEventsContext = storyState?.storyEvents?.length > 0 
        ? `\n\nPrevious Story Events:\n${storyState.storyEvents.slice(-10).join('\n')}`
        : '';
      
      // Debug logging
      console.log(`[DEBUG] Phase Info - Total Interactions: ${nextTotalInteractions}, Adjusted: ${adjustedInteractions}, Phase Index: ${phaseIndex}, Within Phase: ${withinPhaseIndex}, Phase: ${phase}, Is Question Phase: ${isQuestionPhase}, Target Words: ${JSON.stringify(targetWordsToUse)}`);
      console.log(`[DEBUG] Current UI State - currentPhase: ${currentPhase}, phaseProgress: ${phaseProgress}, totalInteractions: ${totalInteractions}`);
      
      // Create phase-specific system prompt
      const phaseInstructions = isQuestionPhase 
        ? `CRITICAL SPELLING CHALLENGE PHASE (${withinPhaseIndex + 1}/3): Your response MUST include the exact word "${targetWordsToUse[0]}" for spelling practice. 

REQUIREMENTS:
- Include the word "${targetWordsToUse[0]}" exactly as written (no variations, plurals, or similar words)
- Use it naturally in the current adventure story context
- Write 2-3 sentences continuing the adventure
- Do NOT ask questions or create puzzles
- The word will be automatically converted to a fill-in-the-blank

Example: "We need to find the powerful ${targetWordsToUse[0]} hidden in the mysterious location..."

TARGET WORD TO INCLUDE: "${targetWordsToUse[0]}"
REMEMBER: Use this exact word in your response!`
        : `You are in CHAT PHASE (${withinPhaseIndex + 1}/3). Respond naturally to continue the adventure story. Write 2-3 sentences continuing the adventure.`;
      
      // Get adventure-specific details from currentAdventure
      const adventureType = currentAdventure.type || storyContext.theme;
      const adventureSetting = currentAdventure.setting || storyContext.setting;
      const adventureGoal = currentAdventure.goal || 'create an amazing adventure together';
      
      const conversationMessages = [
        {
          role: 'system',
          content: `Role & Perspective: Be my loyal companion in an imaginative adventure for children aged 8–14. Speak in the first person as my companion.

${phaseInstructions}

Tone: Friendly, encouraging, and light-hearted, with humor and kid-friendly language. Ask only one question at a time. Keep responses under 80 words. Keep the output to exactly 2–3 short lines, using explicit newline characters (\n) at natural pauses for clean formatting.

Goal: Create fast-paced, mission-oriented adventures with engaging characters, thrilling twists, and cliffhangers. Keep me eager for the next scene and encourage multiple missions to inspire a love for storytelling.

CRITICAL: During question phases, NEVER create riddles, word puzzles, or ask students to guess words. Simply continue the story naturally and include the target word in your narrative. The spelling practice happens automatically through the system.

Adventure Context: ${JSON.stringify(currentAdventure)}${storyEventsContext}

Current Adventure Details:
- Type: ${adventureType}
- Setting: ${adventureSetting}
- Companions: ${storyContext.companions}
- Goal: ${adventureGoal}
- Theme: ${storyContext.theme}

Student Profile (${storyContext.username}): ${selectedStoryId === 'two-sisters' 
  ? 'Loves forests, animals, and mystery. Enjoys cautious exploration and discovering family connections. Passionate about magical nature adventures with talking animals and mystical settings. Prefers realistic art with fantasy touches, magical forest environments, glowing mushrooms, and soft light effects.' 
  : selectedStoryId === 'roblox-showdown' || selectedStoryId === 'captain-asher-time-stranglers'
  ? 'Loves video games, especially Roblox (e.g., "Steal a Brain Rot"), digital adventures, and heroic battles. Passionate about forest magic, technology mashups, and epic adventures with robotic companions. Prefers cartoon-style art with glowing effects, dramatic lighting, and fantasy-sci-fi mashup visuals. Enjoys epic battles, magical powers, and teamwork adventures in futuristic settings.'
  : 'Enjoys creative storytelling and adventure exploration. Open to various adventure themes and settings.'}

Remember: I'm your loyal companion - speak as "I" and refer to the student as "you" or ${storyContext.username}. Always end with excitement and either a cliffhanger or a single engaging question. Match the tone and style to the current adventure context and setting.

Current Phase: ${phase.toUpperCase()} (${withinPhaseIndex + 1}/3)`
        },
        ...currentMessages
          .slice(-30)
          .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        { role: 'user', content: text }
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationMessages })
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      let aiReply = data.reply || 'That sounds like an amazing adventure! What happens next?';
      
      // Insert blanks for question phases - with additional safety check
      const shouldInsertBlanks = isQuestionPhase && targetWordsToUse.length > 0;
      console.log(`[DEBUG] Blank insertion check - isQuestionPhase: ${isQuestionPhase}, targetWords: ${targetWordsToUse.length}, shouldInsert: ${shouldInsertBlanks}`);
      
      if (shouldInsertBlanks) {
        console.log(`[DEBUG] Inserting blanks - Original AI Reply: "${aiReply}"`);
        const originalReply = aiReply;
        aiReply = insertBlanksIntoResponse(aiReply, targetWordsToUse);
        console.log(`[DEBUG] After blank insertion: "${aiReply}"`);
        
        // Final safeguard: if no blanks were inserted in question phase, force insert one
        if (!aiReply.includes('[BLANK:') && isQuestionPhase) {
          console.log(`[DEBUG] EMERGENCY: No blanks found in question phase, force inserting!`);
          // Insert blank at the end of the first sentence
          const sentences = aiReply.split(/[.!?]/);
          if (sentences.length > 0 && sentences[0] && sentences[0].trim()) {
            const firstSentence = sentences[0].trim();
            const restOfText = aiReply.substring(firstSentence.length);
            aiReply = `${firstSentence} [BLANK:${targetWordsToUse[0]?.toLowerCase() || 'word'}]${restOfText}`;
            console.log(`[DEBUG] Emergency blank inserted: "${aiReply}"`);
          }
        }
      } else {
        // Extra safety: ensure no leftover blank patterns leak into chat phase
        const beforeClean = aiReply;
        aiReply = stripBlankPatternsFromText(aiReply);
        if (beforeClean !== aiReply) {
          console.log('[DEBUG] Removed blank patterns from CHAT phase reply');
        }
        console.log(`[DEBUG] Skipping blank insertion - Phase: ${phase}, isQuestionPhase: ${isQuestionPhase}, targetWords: ${targetWordsToUse.length}`);
      }
      
      updateAdventureMessages(prev => {
        const newMessages = [...prev];
        const loadingIndex = newMessages.findIndex(m => m.isLoading);
        if (loadingIndex !== -1) newMessages[loadingIndex] = { role: 'ai', text: aiReply, isLoading: false } as any;
        return newMessages;
      });
      appendStoryMessage({ role: 'ai', text: aiReply });
      
      // Force scroll to bottom after AI response
      setTimeout(forceScrollToBottom, 200);
      
      // Update adventure context based on conversation
      updateAdventureContext(text, aiReply);
      
      // Pass story update to parent component for use in other steps
      const storyUpdate = `User: ${text} | AI: ${aiReply}`;
      onStoryUpdate?.(storyUpdate);
      
      console.log(`Adventure Mode 2 - Phase: ${phase}, Progress: ${withinPhaseIndex + 1}/3, Total: ${nextTotalInteractions}, Target Word: ${targetWordsToUse[0] || 'none'}`);
    } catch (error) {
      console.error('Error in Adventure Mode 2 story beat:', error);
      updateAdventureMessages(prev => {
        const newMessages = [...prev];
        const loadingIndex = newMessages.findIndex(m => m.isLoading);
        if (loadingIndex !== -1) {
          newMessages[loadingIndex] = {
            role: 'ai',
            text: `Wow, that sounds like an exciting adventure! ⚡ Tell me more about what ${storyContext.username} should do next!`,
            isLoading: false
          } as any;
        }
        return newMessages;
      });
      appendStoryMessage({ role: 'ai', text: `Wow, that sounds like an exciting adventure! ⚡ Tell me more about what ${storyContext.username} should do next!` });
      
      // Force scroll to bottom after error response
      setTimeout(forceScrollToBottom, 200);
    }
  };

  // Helper function to auto-scroll input to show latest text
  const scrollInputToEnd = () => {
    if (adventureInputRef.current) {
      // Use setTimeout to ensure the DOM has updated
      setTimeout(() => {
        if (adventureInputRef.current) {
          adventureInputRef.current.scrollLeft = adventureInputRef.current.scrollWidth;
        }
      }, 0);
    }
  };

  // Helper function to stop microphone and reset input when user clicks action buttons
  const stopMicAndResetInput = () => {
    // Stop microphone if it's recording
    if (isAdventureRecording) {
      setIsAdventureRecording(false);
      adventureRecordingRef.current = false;
      if (adventureSpeechRecognition) {
        adventureSpeechRecognition.stop();
        setAdventureSpeechRecognition(null);
      }
    }
    // Always reset the input area and accumulated speech text, regardless of mic state
    setAdventureInput('');
    adventureAccumulatedRef.current = '';
  };

  const toggleAdventureMic = () => {
    if (isAdventureRecording) {
      setIsAdventureRecording(false);
      adventureRecordingRef.current = false;
      if (adventureSpeechRecognition) {
        adventureSpeechRecognition.stop();
        setAdventureSpeechRecognition(null);
      }
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    // Initialize accumulator with any existing typed input so we never "reset"
    adventureAccumulatedRef.current = adventureInput ? (adventureInput.trim() + ' ') : '';
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let newFinalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          newFinalTranscript += result[0].transcript + ' ';
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      if (newFinalTranscript) {
        adventureAccumulatedRef.current += newFinalTranscript;
      }
      const displayTranscript = (adventureAccumulatedRef.current + interimTranscript).trim();
      setAdventureInput(displayTranscript);
      // Auto-scroll to show the latest speech text
      scrollInputToEnd();
    };
    recognition.onend = () => {
      // Auto-restart if user hasn't explicitly stopped, to avoid losing context on long pauses
      if (adventureRecordingRef.current) {
        try { recognition.start(); } catch {}
      } else {
        setIsAdventureRecording(false);
        setAdventureSpeechRecognition(null);
      }
    };
    recognition.onerror = () => {
      // Attempt to recover from transient errors while recording is intended to continue
      if (adventureRecordingRef.current) {
        try { recognition.start(); } catch {}
      }
    };
    recognition.start();
    setAdventureSpeechRecognition(recognition);
    setIsAdventureRecording(true);
    adventureRecordingRef.current = true;
  };

  return (
    <>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
        @keyframes sparkle { 0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.7;} 50% { transform: scale(1.2) rotate(180deg); opacity: 1;} }
        .speech-bubble-ai::before { content: ''; position: absolute; left: -6px; bottom: 12px; width: 0; height: 0; border-style: solid; border-width: 0 0 12px 12px; border-color: transparent transparent rgba(255,255,255,0.98) transparent; transform: rotate(45deg);} 
        .speech-bubble-ai::after { content: ''; position: absolute; left: -5px; bottom: 13px; width: 0; height: 0; border-style: solid; border-width: 0 0 10px 10px; border-color: transparent transparent rgba(255,255,255,0.9) transparent; transform: rotate(45deg); z-index: 1; }
        .speech-bubble-student::before { content: ''; position: absolute; right: -6px; bottom: 12px; width: 0; height: 0; border-style: solid; border-width: 12px 12px 0 0; border-color: #FFFADB transparent transparent transparent; transform: rotate(45deg);} 
        .speech-bubble-student::after { content: ''; position: absolute; right: -5px; bottom: 13px; width: 0; height: 0; border-style: solid; border-width: 10px 10px 0 0; border-color: rgba(255,245,205,0.9) transparent transparent transparent; transform: rotate(45deg); z-index: 1; }
        @keyframes challengeAttention { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
      `}</style>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '0 80px'
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '840px', height: '560px', borderRadius: 32, overflow: 'hidden', boxShadow: '9.6px 14.4px 0 rgba(156, 126, 172, 0.25), 0 22.4px 64px rgba(0,0,0,0.08)' }}>
          <div style={{ position: 'absolute', inset: 0 as any, backgroundImage: `url(${bg1Url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.75 }} />
          <div style={{ position: 'absolute', inset: 0 as any, background: `rgba(0,0,0,${ADVENTURE_IMAGE_OVERLAY_OPACITY})` }} />
          
          {/* Phase indicator */}
          <div style={{
            position: 'absolute',
            top: 16,
            left: 24,
            zIndex: 2,
            background: currentPhase === 'chat' ? 
              'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 
              'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: 16,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'Quicksand, sans-serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            {currentPhase === 'chat' ? '💬' : '📝'} 
            {currentPhase === 'chat' ? 'Adventure Chat' : 'Spelling Challenge'} 
            ({phaseProgress + 1}/3)
          </div>

          {/* Coin display and pet store icon */}
          <div style={{
            position: 'absolute',
            top: 16,
            right: 24,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            {/* Coin display */}
            <div style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              color: '#8B4513',
              padding: '6px 12px',
              borderRadius: 16,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'Quicksand, sans-serif',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <span style={{ fontSize: 14 }}>🪙</span>
              <span>{coins}</span>
            </div>

            {/* Pet store icon */}
            <button
              onClick={() => {
                onNavigateToPetStore?.();
              }}
              style={{
                background: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
                color: 'white',
                border: 'none',
                padding: '8px',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Pet Store"
            >
              🐾
            </button>
          </div>
          
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px', height: '100%' }}>
            <div ref={adventureScrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 6, paddingBottom: 16 }}>
              {adventureMessages.map((m, i) => {
                const stableMessageId = generateStableMessageId(m.text, i);
                return (
                <div key={stableMessageId} className={`${m.role === 'student' ? 'speech-bubble-student' : 'speech-bubble-ai'} ${(m.isImage || m.isLoading) ? 'has-image' : ''}`}
                  style={{ 
                    alignSelf: m.role === 'student' ? 'flex-end' : 'flex-start', 
                    background: m.role === 'student' ? '#FFFADB' : 
                      m.role === 'ai' ? 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)' : 
                      'rgba(255,255,255,0.98)', 
                    color: m.role === 'student' ? '#000000' : '#111827', 
                    padding: (m.isImage || m.isLoading) ? '8px' : 
                      m.role === 'ai' ? '20px 24px 20px 20px' : '10px 26px 10px 14px', 
                    borderRadius: m.role === 'ai' ? 22 : 18, 
                    maxWidth: (m.isImage || m.isLoading) ? '60%' : '85%', 
                    boxShadow: m.role === 'ai' ? 
                      '0 8px 25px rgba(0,0,0,0.08), 0 3px 10px rgba(0,0,0,0.05)' : 
                      '0 6px 18px rgba(0,0,0,0.12)', 
                    position: 'relative', 
                    border: m.role === 'student' ? '1px solid rgba(255,245,205,0.8)' : 
                      m.role === 'ai' ? '1px solid rgba(255,255,255,0.95)' : 
                      '1px solid rgba(255,255,255,0.9)', 
                    marginLeft: m.role === 'student' ? '0' : '12px', 
                    marginRight: m.role === 'student' ? '12px' : '0', 
                    marginBottom: '12px' 
                  }}>
                  {m.isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16, gap: 12 }}>
                      <div style={{ width: 40, height: 40, border: '3px solid rgba(139,92,246,0.2)', borderTop: '3px solid #8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280', textAlign: 'center', fontFamily: 'Quicksand, sans-serif' }}>{m.text}</div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6', animation: 'sparkle 1.5s ease-in-out infinite' }} />
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6', animation: 'sparkle 1.5s ease-in-out infinite 0.3s' }} />
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6', animation: 'sparkle 1.5s ease-in-out infinite 0.6s' }} />
                      </div>
                    </div>
                  ) : m.isImage ? (
                    <div style={{ position: 'relative' }}>
                      {m.text && m.text !== 'IMAGE_GENERATED' && (
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', textAlign: 'center', fontFamily: 'Quicksand, sans-serif', marginBottom: 8 }}>{m.text}</div>
                      )}
                      <img src={m.imageUrl || bg1Url} alt={m.imageUrl ? 'Generated adventure image' : 'Adventure Scene'}
                        onClick={() => { if (m.imageUrl) { setFullscreenImageUrl(m.imageUrl); setShowFullscreenImage(true); } else { setShowFullscreenImage(true); } }}
                        style={{ width: '100%', height: 'auto', maxHeight: 200, objectFit: 'cover', borderRadius: 12, border: '2px solid rgba(255,255,255,0.9)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.02)'; (e.currentTarget as HTMLImageElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLImageElement).style.boxShadow = 'none'; }}
                      />
                      <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500, }}>🔍 {m.imageUrl ? 'Click to open' : 'Click to expand'}</div>
                    </div>
                  ) : m.role === 'ai' ? (
                    <FillInTheBlankMessage
                      text={m.text}
                      messageId={stableMessageId}
                      onAnswerChange={(blankIndex, answer) => {
                        console.log(`[DEBUG] Saving answer for messageId: ${stableMessageId}, blankIndex: ${blankIndex}, answer: "${answer}"`);
                        setBlankAnswers(prev => ({
                          ...prev,
                          [stableMessageId]: {
                            ...prev[stableMessageId],
                            [blankIndex]: answer
                          }
                        }));
                      }}
                      onSpellingComplete={handleSpellingComplete}
                    />
                  ) : (
                    <span style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 17, fontWeight: 500, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.text}</span>
                  )}
                  {m.role === 'ai' && !m.isLoading && !m.isImage ? (
                    <button onClick={() => void toggleAIResponse(i, getCompleteTextForAudio(m.text, stableMessageId))} disabled={audioLoading === i}
                      style={{ 
                        position: 'absolute', 
                        right: 12, 
                        bottom: 12, 
                        width: 32, 
                        height: 32, 
                        borderRadius: 16, 
                        border: 'none', 
                        background: playingAudio === i ? 
                          'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' : 
                          audioLoading === i ?
                          'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)' :
                          'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', 
                        color: 'white', 
                        cursor: audioLoading === i ? 'not-allowed' : 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: 14, 
                        boxShadow: playingAudio === i ? 
                          '0 4px 12px rgba(239, 68, 68, 0.4), 0 2px 6px rgba(0,0,0,0.1)' :
                          '0 4px 12px rgba(59, 130, 246, 0.3), 0 2px 6px rgba(0,0,0,0.1)', 
                        transition: 'all 0.15s ease', 
                        opacity: audioLoading === i ? 0.7 : 1,
                        transform: 'scale(1)'
                      }}
                      title={audioLoading === i ? 'Loading audio...' : playingAudio === i ? 'Stop reading' : 'Listen to story'}
                      onMouseEnter={(e) => { 
                        if (audioLoading !== i) {
                          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)';
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = playingAudio === i ? 
                            '0 6px 16px rgba(239, 68, 68, 0.5), 0 3px 8px rgba(0,0,0,0.15)' :
                            '0 6px 16px rgba(59, 130, 246, 0.4), 0 3px 8px rgba(0,0,0,0.15)';
                        }
                      }}
                      onMouseLeave={(e) => { 
                        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = playingAudio === i ? 
                          '0 4px 12px rgba(239, 68, 68, 0.4), 0 2px 6px rgba(0,0,0,0.1)' :
                          '0 4px 12px rgba(59, 130, 246, 0.3), 0 2px 6px rgba(0,0,0,0.1)';
                      }}
                    >
                      {audioLoading === i ? (
                        <div style={{
                          width: '12px',
                          height: '12px',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTop: '2px solid white',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                      ) : playingAudio === i ? (
                        <div style={{
                          display: 'flex',
                          gap: '2px',
                          alignItems: 'center'
                        }}>
                          <div style={{
                            width: '3px',
                            height: '8px',
                            background: 'white',
                            borderRadius: '1px',
                            animation: 'equalizer 0.6s ease-in-out infinite alternate'
                          }} />
                          <div style={{
                            width: '3px',
                            height: '12px',
                            background: 'white',
                            borderRadius: '1px',
                            animation: 'equalizer 0.6s ease-in-out infinite alternate 0.2s'
                          }} />
                          <div style={{
                            width: '3px',
                            height: '6px',
                            background: 'white',
                            borderRadius: '1px',
                            animation: 'equalizer 0.6s ease-in-out infinite alternate 0.4s'
                          }} />
                        </div>
                      ) : (
                        '🔊'
                      )}
                    </button>
                  ) : (
                    <span style={{ position: 'absolute', right: 12, bottom: 12, fontSize: 14, color: '#10B981', fontWeight: 600 }}>✓</span>
                  )}
                </div>
              );
              })}
            </div>

                          {/* Quick adventure options - show when starting new adventure */}
            {adventureState === 'new' && adventureMessages.length <= 2 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
                {['⚡ Epic Battles', '🎮 Digital Adventures', '🌳 Forest Magic', '🤖 Robot Companions', '💫 Heroic Quests', '🎪 Futuristic Worlds'].map((option) => (
                  <button key={option} onClick={() => {
                    stopMicAndResetInput();
                    const interest = option.split(' ')[1]?.toLowerCase() || option.toLowerCase();
                    setAdventureInput(`I love ${interest} adventures!`);
                    scrollInputToEnd();
                    setTimeout(() => void sendAdventureMessage(), 100);
                  }}
                    style={{ padding: '8px 12px', borderRadius: 16, border: 'none', background: 'rgba(255,255,255,0.9)', color: '#374151', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Quicksand, sans-serif', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', transition: 'all 0.2s ease' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.95)', padding: '8px 12px', borderRadius: 20, gap: 10, border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <input 
                  ref={adventureInputRef}
                  value={adventureInput} 
                  onChange={(e) => { 
                    if (isCurrentSpellingComplete) {
                      setAdventureInput(e.target.value); 
                      scrollInputToEnd(); 
                    }
                  }} 
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter' && isCurrentSpellingComplete) { 
                      stopMicAndResetInput(); 
                      void sendAdventureMessage(); 
                    } 
                  }} 
                  placeholder={isCurrentSpellingComplete ? "Message..." : "Complete the spelling above first..."}
                  disabled={!isCurrentSpellingComplete}
                  style={{ 
                    flex: 1, 
                    background: 'transparent', 
                    border: 'none', 
                    outline: 'none', 
                    color: isCurrentSpellingComplete ? '#111827' : '#9CA3AF', 
                    fontSize: 17, 
                    fontWeight: 400, 
                    fontFamily: 'Quicksand, sans-serif',
                    cursor: isCurrentSpellingComplete ? 'text' : 'not-allowed'
                  }} />
                <button 
                  onClick={() => { 
                    if (isCurrentSpellingComplete) {
                      stopMicAndResetInput(); 
                      void generateAdventureImage(); 
                    }
                  }} 
                  disabled={!isCurrentSpellingComplete}
                  aria-label="Generate Image" 
                  style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 16, 
                    border: '2px solid rgba(16,185,129,0.3)', 
                    background: isCurrentSpellingComplete ? 
                      'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 
                      'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)', 
                    color: 'white', 
                    cursor: isCurrentSpellingComplete ? 'pointer' : 'not-allowed', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: 14,
                    opacity: isCurrentSpellingComplete ? 1 : 0.5
                  }} 
                  title={isCurrentSpellingComplete ? "Generate image from your message" : "Complete spelling first"}>🌄</button>
                {adventureState !== 'new' && (
                  <button 
                    onClick={async () => {
                      if (isCurrentSpellingComplete) {
                        stopMicAndResetInput();
                        setAdventureState('new');
                        // Reset to default context-based adventure
                        setCurrentAdventure(getInitialAdventure());
                        clearStoredBlankAnswers(); // Clear previous spelling progress
                        
                        // Generate AI greeting message
                        updateAdventureMessages(prev => [...prev, { role: 'ai', text: 'Starting your adventure...', isLoading: true }]);
                        
                        try {
                          const storyEventsContext = storyState?.storyEvents?.length > 0 
                            ? `\n\nPrevious Story Events:\n${storyState.storyEvents.slice(-10).join('\n')}`
                            : '';
                          
                          const greetingPrompt = {
                            role: 'system' as const,
                            content: `You are starting a new adventure with the student. Create an exciting, engaging opening message that:

1. Greets ${storyContext.username} enthusiastically
2. Sets up the current adventure scenario from the context
3. Asks an engaging question to get them involved
4. Matches their interests and the adventure theme
5. Keep it concise but exciting (2-3 sentences max)

CRITICAL: During question phases, NEVER create riddles, word puzzles, or ask students to guess words. Simply continue the story naturally and include the target word in your narrative. The spelling practice happens automatically through the system.

Adventure Context: ${JSON.stringify(currentAdventure)}${storyEventsContext}

Setting: ${storyContext.setting}
Companions: ${storyContext.companions}
Themes: ${storyContext.theme}

Student Profile (${storyContext.username}): ${selectedStoryId === 'two-sisters' 
  ? 'Loves forests, animals, and mystery. Enjoys cautious exploration and discovering family connections. Passionate about magical nature adventures with talking animals and mystical settings. Prefers realistic art with fantasy touches, magical forest environments, glowing mushrooms, and soft light effects.' 
  : 'Loves video games, especially Roblox (e.g., "Steal a Brain Rot"), digital adventures, and heroic battles. Passionate about forest magic, technology mashups, and epic adventures with robotic companions. Prefers cartoon-style art with glowing effects, dramatic lighting, and fantasy-sci-fi mashup visuals. Enjoys epic battles, magical powers, and teamwork adventures in futuristic settings.'}

Remember: I'm your loyal companion - speak as "I" and refer to the student as "you" or ${storyContext.username}. Always end with excitement and either a cliffhanger or a single engaging question. Keep responses ${selectedStoryId === 'two-sisters' 
  ? 'mysterious and magical to match the mystical forest setting with talking animals, glowing mushrooms, and family mysteries.' 
  : 'thrilling and action-packed to match the interests in video games, digital adventures, epic battles, and heroic teamwork in futuristic settings.'}

Current Phase: CHAT (1/3)`
                          };

                          const response = await fetch('/api/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              messages: [greetingPrompt],
                              temperature: 0.8,
                              max_tokens: 150
                            })
                          });

                          if (!response.ok) throw new Error('Failed to generate greeting');
                          
                          const data = await response.json();
                          const aiGreeting = data.reply || data.message || storyContext.defaultMessage;
                          
                          updateAdventureMessages(prev => prev.map(msg => 
                            msg.isLoading ? { role: 'ai', text: aiGreeting } : msg
                          ));
                          appendStoryMessage({ role: 'ai', text: aiGreeting });
                          
                        } catch (error) {
                          console.error('Error generating greeting:', error);
                          const fallbackGreeting = storyContext.defaultMessage;
                          updateAdventureMessages(prev => prev.map(msg => 
                            msg.isLoading ? { role: 'ai', text: fallbackGreeting } : msg
                          ));
                          appendStoryMessage({ role: 'ai', text: fallbackGreeting });
                        }
                        
                        // Force scroll to bottom after new adventure greeting
                        setTimeout(forceScrollToBottom, 200);
                      }
                    }} 
                    disabled={!isCurrentSpellingComplete}
                    aria-label="New Adventure" 
                    style={{ 
                      width: 32, 
                      height: 32, 
                      borderRadius: 16, 
                      border: '2px solid rgba(245,158,11,0.3)', 
                      background: isCurrentSpellingComplete ? 
                        'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 
                        'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)', 
                      color: 'white', 
                      cursor: isCurrentSpellingComplete ? 'pointer' : 'not-allowed', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: 14,
                      opacity: isCurrentSpellingComplete ? 1 : 0.5
                    }} 
                    title={isCurrentSpellingComplete ? "Start a new adventure" : "Complete spelling first"}>🎪</button>
                )}
                <button 
                  onClick={() => { 
                    if (isCurrentSpellingComplete) {
                      stopMicAndResetInput(); 
                      void sendAdventureMessage(); 
                    }
                  }} 
                  disabled={!isCurrentSpellingComplete}
                  aria-label="Send" 
                  style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 16, 
                    border: '2px solid rgba(139,92,246,0.3)', 
                    background: isCurrentSpellingComplete ? 
                      'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' : 
                      'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)', 
                    color: 'white', 
                    cursor: isCurrentSpellingComplete ? 'pointer' : 'not-allowed', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    opacity: isCurrentSpellingComplete ? 1 : 0.5
                  }}>▲</button>
              </div>
              <button 
                onClick={() => {
                  if (isCurrentSpellingComplete) {
                    toggleAdventureMic();
                  }
                }} 
                disabled={!isCurrentSpellingComplete}
                aria-label="Record" 
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 24, 
                  border: 'none', 
                  cursor: isCurrentSpellingComplete ? 'pointer' : 'not-allowed', 
                  background: !isCurrentSpellingComplete ? 
                    'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)' :
                    isAdventureRecording ? 
                    'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 
                    'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                  boxShadow: !isCurrentSpellingComplete ? 
                    '0 6px 18px rgba(156, 163, 175, 0.3)' :
                    isAdventureRecording ? 
                    '0 6px 18px rgba(239, 68, 68, 0.3)' : 
                    '0 6px 18px rgba(16, 185, 129, 0.3)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  opacity: isCurrentSpellingComplete ? 1 : 0.5
                }}>
                {isAdventureRecording ? (<div style={{ width: 14, height: 14, background: 'white', borderRadius: 3 }} />) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="white"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="white"/></svg>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Subtle Next button - top right, almost invisible */}
        <button
          onClick={() => {
            onSwitchToQuestions?.();
          }}
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 100,
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.99)',
            color: 'rgb(252, 252, 252)',
            border: '0.2px solid rgb(255, 251, 251)',
            cursor: 'pointer',
            fontSize: '2px',
            fontWeight: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            opacity: 0.0001
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.7';
            e.currentTarget.style.background = 'rgb(255, 255, 255)';
            e.currentTarget.style.color = 'rgb(255, 255, 255)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.0001';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.99)';
            e.currentTarget.style.color = 'rgb(252, 252, 252)';
          }}
          title="Next"
        >
          →
        </button>

        {/* Previous Button - always visible, positioned bottom left
        <button
          onClick={() => {
            // Go back to previous step in the question flow
            onGoToPrevious?.();
          }}
          style={{
            position: 'fixed',
            bottom: 24,
            left: 24,
            zIndex: 100,
            padding: '12px 20px',
            borderRadius: 20,
            border: 'none',
            background: 'linear-gradient(135deg,rgba(107, 114, 128, 0.39) 0%, #6b7280 100%)',
            color: 'white',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'Quicksand, sans-serif',
            cursor: 'pointer',
            boxShadow: '0 8px 16px rgba(192, 195, 199, 0.4)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Go to previous step"
        >
          ⬅️ Previous
        </button> */}

        {/* Begin Challenge Button - DISABLED - might enable later */}
        {false && (
          <button
            onClick={() => {
              onSwitchToQuestions?.();
            }}
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 100,
              padding: '12px 20px',
              borderRadius: 20,
              border: 'none',
              background: 'linear-gradient(135deg, #6F05F0 0%, #6F05F0 100%)',
              color: 'white',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'Quicksand, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              animation: userMessageCount >= 5 ? 'challengeAttention 2s ease-in-out infinite' : 'none'
            }}
            onMouseEnter={(e) => {
              if (userMessageCount < 5) {
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (userMessageCount < 5) {
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
            title={userMessageCount >= 5 ? 'Ready for a challenge!' : `Adventure more! (${userMessageCount}/5 messages)`}
          >
            🎯 Begin Challenge
          </button>
        )}
      </div>

      {showFullscreenImage && (
        <div style={{ position: 'fixed', inset: 0 as any, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowFullscreenImage(false); setFullscreenImageUrl(null); } }}
          onKeyDown={(e) => { if ((e as any).key === 'Escape') { setShowFullscreenImage(false); setFullscreenImageUrl(null); } }}
          tabIndex={0}
        >
          <button onClick={() => { setShowFullscreenImage(false); setFullscreenImageUrl(null); }}
            style={{ position: 'absolute', top: 24, right: 24, width: 56, height: 56, borderRadius: 28, background: 'rgba(255,255,255,0.95)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#374151', boxShadow: '0 6px 20px rgba(0,0,0,0.4)', transition: 'all 0.2s ease', zIndex: 1002, fontWeight: 'bold' }}
            title="Close fullscreen image"
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,1)'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 25px rgba(0,0,0,0.5)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.95)'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)'; }}
          >
            ✕
          </button>
          <img src={fullscreenImageUrl || bg1Url} alt={fullscreenImageUrl ? 'Generated Adventure Image' : 'Adventure Scene'}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
          {fullscreenImageUrl && (
            <div style={{ position: 'absolute', bottom: 24, left: 24, background: 'rgba(0,0,0,0.8)', color: 'white', padding: '12px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, fontFamily: 'Quicksand, sans-serif' }}>🌄 Generated by DALL-E 3</div>
          )}
        </div>
      )}
    </>
  );
}


