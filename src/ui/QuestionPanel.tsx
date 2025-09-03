import React, { useEffect, useRef, useState } from 'react';
import { ImagePanel } from './ImagePanel';
import bg1Url from '../../bg1.png';
import { Question, BlendingQuestion, SpeechQuestion } from './questions/types';
import { blendingQuestions as blendingQuestionsData, speechQuestions as speechQuestionsData, longAQuestions as longAQuestionsData, questions as regularQuestionsData, options } from './questions/data';
import { AdventureMode } from './questions/AdventureMode';
import { AdventureMode2 } from './questions/AdventureMode2';
import { useStory } from './story/StoryStore';
import { audioManager } from './audioManager';

// (audioManager is now shared across UI to enforce single-instance playback)

type Props = {
  selectedStoryId?: string | null;
  onComplete?: () => void;
  onNavigateToPetStore?: () => void;
};

export function QuestionPanel({ selectedStoryId, onComplete, onNavigateToPetStore }: Props): JSX.Element {
  const { state: storyState, appendEvent, setHookForStep, setPendingAdventureChat } = useStory();
  // Blending question data (first question) - COMMENTED OUT FOR NOW
  const blendingQuestions: BlendingQuestion[] = []; // blendingQuestionsData;

  // Speech question data
  const speechQuestions: SpeechQuestion[] = speechQuestionsData;

  // Long A question data  
  const longAQuestions: Question[] = longAQuestionsData;

  // Question data
  const questions: Question[] = regularQuestionsData;
  
  // Flow order: adventure mode 2 (step 1) -> adventure mode (step 2) -> long A questions -> speech -> adventure mode -> regular questions -> adventure mode (blending step removed)
  const totalSteps = 1 + 1 + blendingQuestions.length + longAQuestions.length + speechQuestions.length + 1 + questions.length + 1;
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [spellingInput, setSpellingInput] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  
  // Speech-related state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [realtimeTranscript, setRealtimeTranscript] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [speechRecognition, setSpeechRecognition] = useState<any>(null);
  const [speechSuccess, setSpeechSuccess] = useState<boolean>(false);
  const [showSpeechContinuation, setShowSpeechContinuation] = useState<boolean>(false);
  const [speechContinuationInput, setSpeechContinuationInput] = useState<string>('');
  const [speechValidationMessage, setSpeechValidationMessage] = useState<string>('');
  const [hasAutoplayedSpeechPrompt, setHasAutoplayedSpeechPrompt] = useState<boolean>(false);
  // AI hint for speech step
  const [speechHint, setSpeechHint] = useState<string>('');
  const [isSpeechHintLoading, setIsSpeechHintLoading] = useState<boolean>(false);
  // Track that a speech attempt finished processing, even if transcript is empty
  const [hasSpeechEvaluated, setHasSpeechEvaluated] = useState<boolean>(false);
  // Global speech state for toggle-able audio button
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  // Focus handle for speech Try Again
  const tryAgainBtnRef = useRef<HTMLButtonElement | null>(null);
  // Story continuation experiment state
  const [storyContext, setStoryContext] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);
  const [isSummarySpeaking, setIsSummarySpeaking] = useState<boolean>(false);
  
  // Dynamic speech passage state
  const [dynamicSpeechPassage, setDynamicSpeechPassage] = useState<string>('');
  const [hasDynamicPassage, setHasDynamicPassage] = useState<boolean>(false);
  const [isDynamicPassageLoading, setIsDynamicPassageLoading] = useState<boolean>(false);
  const summaryAudioRef = useRef<HTMLAudioElement | null>(null);
  // Track current ad-hoc ElevenLabs playback label for toggle buttons
  const currentElevenLabelRef = useRef<string | null>(null);
  // Track last autoplayed speech passage to avoid replays
  const lastAutoplayedSpeechPassageRef = useRef<string | null>(null);
  const [hasAutoplayedSummary, setHasAutoplayedSummary] = useState<boolean>(false);
  const [hasGeneratedSummary, setHasGeneratedSummary] = useState<boolean>(false);
  // Long A specific passage state
  const [longAPassage, setLongAPassage] = useState<string>('');
  
  // Dev mode navigation (MSA keys)
  const [isDevModeActive, setIsDevModeActive] = useState(false);
  const [hasGeneratedLongAPassage, setHasGeneratedLongAPassage] = useState<boolean>(false);
  const [hasAutoplayedLongAPassage, setHasAutoplayedLongAPassage] = useState<boolean>(false);
  const [isLongAPassageLoading, setIsLongAPassageLoading] = useState<boolean>(false);
  const [summaryRefreshCount, setSummaryRefreshCount] = useState<number>(0);
  const [continuationInput, setContinuationInput] = useState<string>('');
  const [validationMessage, setValidationMessage] = useState<string>(''); // AI 1-2 word reply
  const [validatedContinuation, setValidatedContinuation] = useState<string>(''); // shows as user bubble
  // Short Socratic hint when an answer is incorrect
  const [incorrectHint, setIncorrectHint] = useState<string>('');
  const [isIncorrectHintLoading, setIsIncorrectHintLoading] = useState<boolean>(false);
  // Voice capture for continuation (lightweight Web Speech API)
  const [isContRecording, setIsContRecording] = useState<boolean>(false);
  const [contRecognition, setContRecognition] = useState<any>(null);
  const [contMediaRecorder, setContMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isContProcessing, setIsContProcessing] = useState<boolean>(false);
  const [isContinuationAnimating, setIsContinuationAnimating] = useState<boolean>(false);
  const [isContinuationHidden, setIsContinuationHidden] = useState<boolean>(false);
  const [isFeedbackRemoved, setIsFeedbackRemoved] = useState<boolean>(false);
  const [hasAutoplayedContPrompt, setHasAutoplayedContPrompt] = useState<boolean>(false);
  // Dynamic header shown in the green container during continuation (CTA or AI help lines)
  const [continuationHeader, setContinuationHeader] = useState<string>('');
  const [isContinuationHeaderLoading, setIsContinuationHeaderLoading] = useState<boolean>(false);
  
  // Sorting question state
  const [sortingAnswers, setSortingAnswers] = useState<{[binLabel: string]: string[]}>({});
  const [draggingWord, setDraggingWord] = useState<string | null>(null);

  // Image-step state (optional branch after a successful response)
  const [isImageStepActive, setIsImageStepActive] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageDescription, setImageDescription] = useState<string>('');
  const [imageFlowSource, setImageFlowSource] = useState<'regular' | 'speech' | null>(null);
  const [isImageRecording, setIsImageRecording] = useState<boolean>(false);
  const [imageRecognition, setImageRecognition] = useState<any>(null);
  // Auto image generation for emoji questions
  const questionImageCacheRef = useRef<Map<string, string>>(new Map());
  const [questionImageUrl, setQuestionImageUrl] = useState<string | null>(null);
  const [questionImageLoading, setQuestionImageLoading] = useState<boolean>(false);
  const pregenStartedRef = useRef<boolean>(false);
  const [questionImageRegenerating, setQuestionImageRegenerating] = useState<boolean>(false);
  // Speech recording for speech continuation input
  const [isSpeechContRecording, setIsSpeechContRecording] = useState<boolean>(false);
  const [speechContRecognition, setSpeechContRecognition] = useState<any>(null);
  
  // Feature flag: Enable/disable image generation from continuation messages
  // Set to false to disable, true to enable - can be easily toggled later
  const ENABLE_CONTINUATION_IMAGE_GENERATION = false;
  
  // Lightweight back-and-forth chat during incorrect attempts
  const sendIncorrectFollowup = async (studentText: string): Promise<void> => {
    try {
      setIsContinuationHeaderLoading(true);
      const target = hookTargetWord;
      const system = `Speak like a warm, playful tutor for young readers. Be natural and Socratic.
Rules:
- Reply in at most two short sentences (<=25 words total).
- Do not reveal the target word.
- Encourage, ask one small guiding question if helpful.
- Keep focus on listening and long-\u0101 spelling for this step.
- Optional theme: adventure.`;
      const user = `Context: Step 4 spelling practice (long-\u0101). Target word (do not say): ${target}.
Student said: ${studentText}
Give a brief, friendly response that nudges them without giving the answer.`;
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ] })
      });
      const data = await res.json();
      const reply = (data?.reply || '').trim();
      if (reply) {
        setContinuationHeader(reply);
        try { audioManager.stopAll(); currentElevenLabelRef.current = reply; await playElevenTTS(reply); } catch {}
      } else {
        setContinuationHeader('Good thinking! Listen once more—what long-\u0101 fits best?');
      }
    } catch {
      setContinuationHeader('Good thinking! Listen once more—what long-\u0101 fits best?');
    } finally {
      setIsContinuationHeaderLoading(false);
    }
  };
  
  // Blending-related state
  const [blendingSoundOn, setBlendingSoundOn] = useState(true);
  
  // Helper function to check speech reading success
  const checkSpeechSuccess = (transcript: string): boolean => {
    if (!transcript || !currentSpeechQuestion) return false;
    const lowerTranscript = transcript.toLowerCase();
    const expectedWords = currentSpeechQuestion.expectedWords || [];
    
    // Check if at least 3 out of 5 expected words are present, or 60% of the words
    const foundWords = expectedWords.filter(word => lowerTranscript.includes(word.toLowerCase()));
    const requiredWords = Math.max(3, Math.ceil(expectedWords.length * 0.6));
    
    console.log('🎯 Speech success check:', {
      transcript: lowerTranscript,
      expectedWords,
      foundWords,
      requiredWords,
      success: foundWords.length >= requiredWords
    });
    
    return foundWords.length >= requiredWords;
  };



  // Generate AI hint for speech (without auto-playing)
  const generateSpeechHint = async (transcript: string) => {
    if (!currentSpeechQuestion) return;
    
    try {
      setIsSpeechHintLoading(true);
      const sys = 'You are a friendly, concise reading coach for kids. Be specific, warm, and brief (max 15 words). Do not scold. Nudge user to try again and read entire passage.';
      const user = `The child read: "${transcript}". Target passage focuses on these key words: ${currentSpeechQuestion.expectedWords.join(', ')}. Give one natural-sounding hint that nudges them to read entire passage including 2–3 of those words next time.`;
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ] })
      });
      const d = await r.json();
      const hint = (d?.reply || '').trim();
      const finalHint = hint || `Try to include words like ${currentSpeechQuestion.expectedWords.slice(0,3).join(', ')}.`;
      setSpeechHint(finalHint);
      console.log('💾 Generated AI hint (not auto-playing):', finalHint);
    } catch {
      const finalHint = `Try to include words like ${currentSpeechQuestion.expectedWords.slice(0,3).join(', ')}.`;
      setSpeechHint(finalHint);
      console.log('💾 Generated fallback AI hint (not auto-playing):', finalHint);
    } finally {
      setIsSpeechHintLoading(false);
    }
  };
  const [currentPhonemeIndex, setCurrentPhonemeIndex] = useState(-1); // -1 means no highlight
  const [blendingTranscript, setBlendingTranscript] = useState<string>('');
  const [blendingRealtimeTranscript, setBlendingRealtimeTranscript] = useState<string>('');
  const [isBlendingRecording, setIsBlendingRecording] = useState(false);
  const [isBlendingProcessing, setIsBlendingProcessing] = useState(false);
  const [blendingAudioBlob, setBlendingAudioBlob] = useState<Blob | null>(null);
  const [blendingMediaRecorder, setBlendingMediaRecorder] = useState<MediaRecorder | null>(null);
  const [blendingRecognition, setBlendingRecognition] = useState<any>(null);
  // Auto-stop on silence during speech recording
  const silenceTimerRef = useRef<number | null>(null);
  
  // Focus the Try Again button when speech result appears
  useEffect(() => {
    if (!isRecording && transcript && !showSpeechContinuation) {
      tryAgainBtnRef.current?.focus();
    }
  }, [isRecording, transcript, showSpeechContinuation]);
  
  const replaySpeechPassage = async (): Promise<void> => {
    try {
      const textToSpeak = (dynamicSpeechPassage && dynamicSpeechPassage.trim()) || currentSpeechQuestion?.text || '';
      if (!textToSpeak) return;
      audioManager.stopAll();
      currentElevenLabelRef.current = textToSpeak;
      await playElevenTTS(textToSpeak);
    } catch {}
  };
  
  // Determine current step type
  const isAdventureMode1 = currentQuestionIndex === 0;
  const isAdventureMode2 = currentQuestionIndex === 1;
  const isBlendingQuestion = currentQuestionIndex >= 2 && currentQuestionIndex < 2 + blendingQuestions.length;
  const isLongAQuestion = currentQuestionIndex >= 2 + blendingQuestions.length && currentQuestionIndex < 2 + blendingQuestions.length + longAQuestions.length;
  const isSpeechQuestion = currentQuestionIndex >= 2 + blendingQuestions.length + longAQuestions.length && currentQuestionIndex < 2 + blendingQuestions.length + longAQuestions.length + speechQuestions.length;
  const isAdventureMode5 = currentQuestionIndex === (2 + blendingQuestions.length + longAQuestions.length + speechQuestions.length);
  const isAdventureMode10 = currentQuestionIndex === (2 + blendingQuestions.length + longAQuestions.length + speechQuestions.length + 1 + questions.length);
  const isAdventureMode = isAdventureMode1 || isAdventureMode2 || isAdventureMode5 || isAdventureMode10;
  const currentBlendingQuestion = isBlendingQuestion ? blendingQuestions[currentQuestionIndex - 2] : null;
  const currentLongAQuestion = isLongAQuestion ? longAQuestions[currentQuestionIndex - 2 - blendingQuestions.length] : null;
  const currentSpeechQuestion = isSpeechQuestion ? speechQuestions[currentQuestionIndex - 2 - blendingQuestions.length - longAQuestions.length] : null;
  const currentRegularQuestion = (!isBlendingQuestion && !isSpeechQuestion && !isLongAQuestion && !isAdventureMode)
    ? questions[currentQuestionIndex - 2 - blendingQuestions.length - longAQuestions.length - speechQuestions.length - 1]
    : null;
  // Continuation experiment flags (now data-driven via aiHook)
  const isFirstRegularStep = (!isBlendingQuestion && !isSpeechQuestion && !isLongAQuestion && !isAdventureMode && currentRegularQuestion?.id === 1);
  const isSecondRegularStep = (!isBlendingQuestion && !isSpeechQuestion && !isLongAQuestion && !isAdventureMode && currentRegularQuestion?.id === 2);
  const isAiHookStep = !!(currentRegularQuestion?.aiHook || currentLongAQuestion?.aiHook);
  const isContinuationStep = isAiHookStep;

  // AI hook config (data-driven) with safe fallbacks to preserve current behavior
  const aiCfg = currentRegularQuestion?.aiHook || currentLongAQuestion?.aiHook;
  const hookTargetWord = aiCfg?.targetWord || (isSecondRegularStep ? 'map' : (isFirstRegularStep ? 'path' : (currentRegularQuestion?.word || currentLongAQuestion?.word || '')));
  const hookQuestionLine = aiCfg?.questionLine || (isFirstRegularStep ? 'Listen and type the word' : 'Listen and type the word');
  const hookBaseLine = aiCfg?.baseLine || (isFirstRegularStep
    ? 'With baking wisdom gained, London moves deeper into the magical bakery paths.'
    : 'The bakery whispers with ancient recipes as London continues her quest through the enchanted kitchen.');
  const hookValidationWord = aiCfg?.validationWord || (isSecondRegularStep ? 'map' : (isFirstRegularStep ? 'path' : (currentLongAQuestion?.word || 'word')));
  const hookIntent = aiCfg?.intent || (isFirstRegularStep ? 'spelling' : 'spelling');

  // Context helpers (centralized, but preserving existing behavior)
  const buildContextText = (): string => {
    return storyContext.join('\n');
  };
  const getLastEvent = (): string => {
    // For the first regular step (Step 5), prefer the validated continuation from Step 4.
    if (isFirstRegularStep && validatedContinuation) return validatedContinuation;
    // For the second regular step (Step 7), bridge from the most recent story context (Step 6 adventure message).
    if (isSecondRegularStep) return storyContext[storyContext.length - 1] || validatedContinuation || '';
    // Fallback: latest context event
    return storyContext[storyContext.length - 1] || '';
  };

  // Pick the latest meaningful story event, skipping image bookkeeping
  const getLatestMeaningfulEvent = (): string => {
    try {
      const events = Array.isArray(storyState?.storyEvents) ? storyState!.storyEvents : [];
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const e = String(events[i] || '').trim();
        if (!e) continue;
        const lower = e.toLowerCase();
        if (lower.startsWith('image created:') || lower.startsWith('image regenerated:')) continue;
        return e;
      }
    } catch {}
    // Fall back to local context chain
    const ctx = getLastEvent();
    return ctx || '';
  };

  // Force-regenerate the current question image using most recent story context
  const regenerateQuestionImage = async (): Promise<void> => {
    const studentId = String(storyState?.metadata?.protagonist || 'student').toLowerCase().replace(/\s+/g, '-') || 'student';
    const stepKey = isLongAQuestion ? 'longA' : (!isBlendingQuestion && !isSpeechQuestion && !isAdventureMode ? 'regular' : '');
    const questionId = isLongAQuestion ? currentLongAQuestion?.id : currentRegularQuestion?.id;
    if (!stepKey || !questionId) return;
    const key = `${studentId}:${stepKey}:${questionId}`;
    const explicitPrompt = aiCfg?.imagePrompt;
    const targetWord = hookTargetWord || currentRegularQuestion?.word || currentLongAQuestion?.word || '';
    const basePrompt = buildQuestionImagePrompt({
      targetWord,
      baseLine: hookBaseLine,
      questionLine: hookQuestionLine,
      explicit: explicitPrompt
    });
    // Force-inject the latest story beat explicitly at the front to ensure model prioritizes it
    const latestEvent = getLatestMeaningfulEvent();
    const prompt = latestEvent
      ? `Reflect this new story update front-and-center: ${latestEvent}. ${basePrompt}`
      : basePrompt;
    
    // Log regeneration details
    console.log('=== QUESTION PANEL REGENERATE IMAGE ===');
    console.log('Function: QuestionPanel.regenerateQuestionImage');
    console.log('Student ID:', studentId);
    console.log('Step Key:', stepKey);
    console.log('Question ID:', questionId);
    console.log('Cache Key:', key);
    console.log('Base prompt:', basePrompt);
    console.log('Final prompt with latest event:', prompt);
    console.log('=====================================');
    
    try {
      setQuestionImageRegenerating(true);
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      const url = (data?.imageUrl || '').trim();
      if (url) {
        questionImageCacheRef.current.set(key, url);
        setQuestionImageUrl(url);
        try { window.localStorage.setItem(`images:v1:${key}`, url); } catch {}
        try { appendEvent(`Image regenerated: ${prompt}`); } catch {}
      }
    } catch {
      // ignore errors; keep current image
    } finally {
      setQuestionImageRegenerating(false);
    }
  };

  // Build a DALL·E prompt for the current question image
  const buildQuestionImagePrompt = (params: { targetWord: string; baseLine: string; questionLine: string; explicit?: string }): string => {
    if (params.explicit && params.explicit.trim()) return params.explicit.trim();
    
    const word = params.targetWord;
    const base = params.baseLine || '';
    const ask = params.questionLine || '';
    
    // Get comprehensive story context
    const storyContext = buildContextText();
    const latestEvent = getLastEvent();
    const latestMeaningfulEvent = getLatestMeaningfulEvent();
    
    // Build rich context for the image
    let contextText = '';
    if (latestMeaningfulEvent) {
      contextText = `Current story situation: ${latestMeaningfulEvent}`;
    } else if (latestEvent) {
      contextText = `Story context: ${latestEvent}`;
    } else if (storyContext) {
      contextText = `Adventure background: ${storyContext.slice(-150)}`;
    } else {
      contextText = base;
    }
    
    // Keep short; /api/image will wrap with kid-safe epic style
    return `Clear, unmistakable depiction of the word "${word}" inside our magical bakery adventure. ${contextText}. Educational hint: ${ask}. Ensure the subject visually communicates "${word}" at a glance while fitting seamlessly into the ongoing story. Ensure it does not have any moderated content and strictly avoid nudity, sexual scenes or sensual poses or dresses.`;
  };

  const ensureQuestionImage = async (key: string, explicitPrompt?: string) => {
    console.log('=== ENSURE QUESTION IMAGE ===');
    console.log('Key:', key);
    console.log('Cache has key:', questionImageCacheRef.current.has(key));
    
    if (questionImageCacheRef.current.has(key)) {
      const cachedUrl = questionImageCacheRef.current.get(key) || null;
      console.log('Found in memory cache:', cachedUrl);
      setQuestionImageUrl(cachedUrl);
      return;
    }
    
    // Persist once-per-student using story local storage bucket
    try {
      const storeKey = `images:v1:${key}`;
      const existing = window.localStorage.getItem(storeKey);
      console.log('Checking localStorage for:', storeKey);
      console.log('Found in localStorage:', existing ? 'YES' : 'NO');
      
      if (existing) {
        console.log('Adding to cache and setting URL:', existing);
        questionImageCacheRef.current.set(key, existing);
        setQuestionImageUrl(existing);
        return;
      }
    } catch (error) {
      console.error('Error accessing localStorage:', error);
    }
    const targetWord = hookTargetWord || currentRegularQuestion?.word || currentLongAQuestion?.word || '';
    const prompt = buildQuestionImagePrompt({
      targetWord,
      baseLine: hookBaseLine,
      questionLine: hookQuestionLine,
      explicit: explicitPrompt
    });
    
    // Log question image generation
    console.log('=== QUESTION PANEL ENSURE IMAGE ===');
    console.log('Function: QuestionPanel.ensureQuestionImage');
    console.log('Cache Key:', key);
    console.log('Target Word:', targetWord);
    console.log('Explicit Prompt:', explicitPrompt);
    console.log('Generated prompt:', prompt);
    console.log('================================');
    
    try {
      setQuestionImageLoading(true);
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      const url = (data?.imageUrl || '').trim();
      if (url) {
        questionImageCacheRef.current.set(key, url);
        setQuestionImageUrl(url);
        try { window.localStorage.setItem(`images:v1:${key}`, url); } catch {}
      }
    } catch {
      // ignore; will fall back to emojis
    } finally {
      setQuestionImageLoading(false);
    }
  };

  // When a question with emoji image enters view, generate and swap in contextual art
  useEffect(() => {
    // Reset image state for new question
    setQuestionImageUrl(null);
    setQuestionImageLoading(false);
    
    const studentId = String(storyState?.metadata?.protagonist || 'student').toLowerCase().replace(/\s+/g, '-') || 'student';
    const stepKey = isSpeechQuestion ? 'speech' : isLongAQuestion ? 'longA' : (!isBlendingQuestion && !isAdventureMode ? 'regular' : '');
    const questionId = isSpeechQuestion ? currentSpeechQuestion?.id : isLongAQuestion ? currentLongAQuestion?.id : currentRegularQuestion?.id;
    const aiImagePrompt = aiCfg?.imagePrompt;
    const display = isSpeechQuestion ? currentSpeechQuestion?.imageUrl : isLongAQuestion ? currentLongAQuestion?.imageUrl : currentRegularQuestion?.imageUrl;
    const isEmoji = !!display && !String(display).startsWith('http');
    
    console.log('=== QUESTION IMAGE DISPLAY ===');
    console.log('stepKey:', stepKey, 'questionId:', questionId, 'isEmoji:', isEmoji);
    console.log('display value:', display);
    
    if (!stepKey || !questionId || !isEmoji) {
      console.log('Skipping image processing - conditions not met');
      return;
    }
    
    const key = `${studentId}:${stepKey}:${questionId}`;
    console.log('Processing image for key:', key);
    
    // Always call ensureQuestionImage which will handle cache and localStorage lookup
    void ensureQuestionImage(key, aiImagePrompt);
  }, [currentQuestionIndex]);

  // Restore question image cache from localStorage on component mount
  useEffect(() => {
    const studentId = String(storyState?.metadata?.protagonist || 'student').toLowerCase().replace(/\s+/g, '-') || 'student';
    const restoreCache = () => {
      // Restore images for Long A questions
      for (const q of longAQuestions) {
        const isEmoji = !!q.imageUrl && !String(q.imageUrl).startsWith('http');
        if (!isEmoji) continue;
        const key = `${studentId}:longA:${q.id}`;
        try {
          const existing = window.localStorage.getItem(`images:v1:${key}`);
          if (existing) {
            questionImageCacheRef.current.set(key, existing);
          }
        } catch {}
      }
      
      // Restore images for regular questions
      for (const q of questions) {
        const isEmoji = !!q.imageUrl && !String(q.imageUrl).startsWith('http');
        if (!isEmoji) continue;
        const key = `${studentId}:regular:${q.id}`;
        try {
          const existing = window.localStorage.getItem(`images:v1:${key}`);
          if (existing) {
            questionImageCacheRef.current.set(key, existing);
          }
        } catch {}
      }
      
      // Restore images for speech questions
      for (const q of speechQuestions) {
        const isEmoji = !!q.imageUrl && !String(q.imageUrl).startsWith('http');
        if (!isEmoji) continue;
        const key = `${studentId}:speech:${q.id}`;
        try {
          const existing = window.localStorage.getItem(`images:v1:${key}`);
          if (existing) {
            questionImageCacheRef.current.set(key, existing);
          }
        } catch {}
      }
    };
    
    restoreCache();
    console.log('=== CACHE RESTORATION COMPLETE ===');
    console.log('Cache size:', questionImageCacheRef.current.size);
    console.log('Cache keys:', Array.from(questionImageCacheRef.current.keys()));
  }, []); // Run only once on mount

  // Pre-generate question images with priority so the user never waits
  useEffect(() => {
    if (pregenStartedRef.current) return;
    pregenStartedRef.current = true;
    const studentId = String(storyState?.metadata?.protagonist || 'student').toLowerCase().replace(/\s+/g, '-') || 'student';
    const pregen = async () => {
      const items: Array<{ key: string; hook?: any; explicit?: string }> = [];
      // Priority 1: Long A (first image steps the student sees)
      for (const q of longAQuestions) {
        const isEmoji = !!q.imageUrl && !String(q.imageUrl).startsWith('http');
        if (!isEmoji) continue;
        const key = `${studentId}:longA:${q.id}`;
        try { if (window.localStorage.getItem(`images:v1:${key}`)) continue; } catch {}
        items.push({ key, hook: q.aiHook, explicit: q.aiHook?.imagePrompt });
      }
      // Priority 2: Regular
      for (const q of questions) {
        const isEmoji = !!q.imageUrl && !String(q.imageUrl).startsWith('http');
        if (!isEmoji) continue;
        const key = `${studentId}:regular:${q.id}`;
        try { if (window.localStorage.getItem(`images:v1:${key}`)) continue; } catch {}
        items.push({ key, hook: q.aiHook, explicit: q.aiHook?.imagePrompt });
      }

      // Generate all Long A immediately plus the first two regular questions
      const IMMEDIATE_BATCH_SIZE = Math.max(longAQuestions.length + 2, 3);
      const immediate = items.slice(0, IMMEDIATE_BATCH_SIZE);
      const background = items.slice(IMMEDIATE_BATCH_SIZE);

      const generateSeq = async (list: typeof items) => {
        for (const it of list) {
          const hook = it.hook || {};
          const prompt = it.explicit && String(it.explicit).trim()
            ? String(it.explicit).trim()
            : buildQuestionImagePrompt({
                targetWord: hook.targetWord || '',
                baseLine: hook.baseLine || '',
                questionLine: hook.questionLine || ''
              });
          try {
            // Log bulk pregeneration
            console.log('=== QUESTION PANEL BULK PREGENERATION ===');
            console.log('Function: QuestionPanel bulk pregeneration');
            console.log('Item key:', it.key);
            console.log('Hook:', hook);
            console.log('Generated prompt:', prompt);
            console.log('======================================');
            
            const res = await fetch('/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
            const data = await res.json();
            const url = (data?.imageUrl || '').trim();
            if (url) {
              try { window.localStorage.setItem(`images:v1:${it.key}`, url); } catch {}
              questionImageCacheRef.current.set(it.key, url);
            }
          } catch {
            // Ignore failures; questions will fall back gracefully
          }
        }
      };

      await generateSeq(immediate);
      const schedule = (cb: () => void) => {
        try { (window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb) : setTimeout(cb, 0); } catch { setTimeout(cb, 0); }
      };
      schedule(() => { void generateSeq(background); });
    };
    void pregen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dev mode navigation - detect MSA key combination
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // MSA = Meta + Shift + Alt
      if (e.metaKey && e.shiftKey && e.altKey) {
        setIsDevModeActive(true);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // When any of the MSA keys are released, disable dev mode
      if (!e.metaKey || !e.shiftKey || !e.altKey) {
        setIsDevModeActive(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Helper function to check if a word follows the Floss rule
  const isFlossRuleWord = (word: string): boolean => {
    const flossWords = ['fluff', 'jazz', 'shell', 'buzz', 'fizz', 'spill', 'staff'];
    return flossWords.includes(word.toLowerCase());
  };

  // Generate a brief Socratic hint for incorrect spelling answers (max 2 sentences)
  const generateIncorrectHint = async (params: {
    targetWord: string;
    studentAnswer: string;
    theme?: string;
    isSorting?: boolean;
    sortingWords?: string[];
    correctSortingAnswer?: {[key: string]: string[]};
  }): Promise<void> => {
    try {
      setIsIncorrectHintLoading(true);
      const { targetWord, studentAnswer, theme, isSorting, sortingWords, correctSortingAnswer } = params;
      
      let systemPrompt: string;
      let userPrompt: string;
      
      if (isSorting && sortingWords && correctSortingAnswer) {
        // Special handling for sorting questions
        systemPrompt = `Speak like a warm, playful tutor for young readers. Be encouraging and natural—no meta talk.
Your reply must be at most two short sentences (25 words total). Help the student think about vowel sounds without directly revealing the answer. Focus on listening to the long-ā sound patterns.
Optional theme: ${theme || 'adventure'}.`;

        userPrompt = `The student is sorting words by their long-ā vowel patterns: "ay" vs "a_e".
Words to sort: ${sortingWords.join(', ')}
Student's current sorting: ${studentAnswer}
Correct pattern: ay words (${correctSortingAnswer['ay']?.join(', ')}) vs a_e words (${correctSortingAnswer['a_e']?.join(', ')})

Give a gentle hint about listening to the vowel sounds without revealing which words go where. Encourage them to listen carefully to the long-ā patterns.`;
      } else if (isFlossRuleWord(targetWord)) {
        // Special handling for Floss rule words
        systemPrompt = `Speak like a warm, playful tutor for young readers. Be encouraging and natural—no meta talk.
Your reply must be at most two short sentences (25 words total). Analyze the student's specific attempt and give personalized feedback. Reference the Floss rule when helpful, but focus on what they got right and what needs fixing.
Optional theme: ${theme || 'adventure'}.`;

        userPrompt = `Question: Spell the word you hear.
Target word (do not say): ${targetWord}
Student attempt: "${studentAnswer || '(blank)'}"

Analyze their specific attempt. What did they get right? What's wrong? This is a Floss rule word (short vowel + double final consonant f/l/s/z). Give personalized feedback that addresses their specific mistake and guides them toward the Floss rule concept.

Examples of good responses:
- If they wrote "flif" for "fluff": "Good start with 'fl'! You need that short 'u' sound and the Floss rule - double the 'f'."
- If they wrote "fuf" for "fluff": "You got the 'f' sounds right! Add the 'l' and remember to double that final 'f'."
- If they wrote "fluff" but for "staff": "Close! Try 'st' at the start, then that short 'a' with double 'f'."

Be specific to their attempt, not generic.`;
      } else {
        // Original spelling question handling
        systemPrompt = `Speak like a warm, playful, socratic tutor for young readers. Be natural—no meta talk.
Your reply must be at most two short sentences (25 words total). If possible, show the user why they were wrong (eg, by sounding out their spelling attempt if that makes sense). Avoid directly revealing the answer, but instead socratically give hint(s) if appropriate, in a natural manner. If you're giving options, say something like: "Here are some options: .." 
Optional theme: ${theme || 'adventure'}.`;

        userPrompt = `Question: Type the word you hear.
Target word (do not say): ${targetWord}
Student attempt: ${studentAnswer || '(blank)'}
Focus: long-ā spelling patterns
Theme: ${theme || 'adventure'}
Write one friendly nudge and then three natural-looking variants of the same word shape, comma-separated. Do not say which one is right.`;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });
      const data = await res.json();
      const aiText = (data?.reply || '').trim();
      if (aiText) {
        setIncorrectHint(aiText);
        // Autoplay the hint via ElevenLabs
        try {
          audioManager.stopAll();
          currentElevenLabelRef.current = aiText;
          await playElevenTTS(aiText);
        } catch {}
        return;
      }
    } catch {
      // Fallback: compact, generic hint builder
      const buildVariants = (word: string): string[] => {
        const lower = word.toLowerCase();
        const idx = lower.indexOf('a');
        if (idx === -1) return ['a_e', 'ai', 'ay', 'ea', 'eigh', 'ey'];
        const starts = lower.slice(0, idx);
        const ends = lower.endsWith('e') ? lower.slice(idx + 1, -1) : lower.slice(idx + 1);
        const make = (mid: string, addSilentE: boolean) => `${starts}${mid}${ends}${addSilentE ? 'e' : ''}`;
        const silentE = lower.endsWith('e');
        const variants = [
          make('a', silentE), // original shape
          make('ai', false),
          make('ay', false),
          make('ea', false),
          make('eigh', false),
          make('ey', false)
        ];
        // Deduplicate while preserving order
        return Array.from(new Set(variants));
      };
      const word = params.targetWord || 'gate';
      const variants = buildVariants(word).slice(0, 3);
      const fallback = `Nice try, adventurer! Choose the long-ā that looks right: ${variants.join(', ')} — all are valid long-ā spellings in different words.`;
      setIncorrectHint(fallback);
      try { audioManager.stopAll(); currentElevenLabelRef.current = fallback; await playElevenTTS(fallback); } catch {}
    } finally {
      setIsIncorrectHintLoading(false);
    }
  };

  // (Adventure mode state moved into AdventureMode component)

  // (Adventure mode auto-scroll handled in AdventureMode)

  // (Adventure mode audio setup handled in AdventureMode)

  // (Adventure mode auto-play handled in AdventureMode)

  // (Adventure image generation handled in AdventureMode)

  // (Adventure TTS handled in AdventureMode)

  // (Adventure messaging handled in AdventureMode)

  // (Adventure mic handling moved into AdventureMode)

  const handlePhonemeSound = (phoneme: string) => {
    // Play the sound of the individual phoneme
    if ('speechSynthesis' in window) {
      // Create proper phonetic pronunciation for specific phonemes
      let soundToPlay = phoneme;
      
      // Map phonemes to their actual sounds
      switch (phoneme.toLowerCase()) {
        case 'th':
          soundToPlay = 'thuh'; // The actual "th" sound like in "think"
          break;
        case 'ch':
          soundToPlay = 'chuh'; // The actual "ch" sound like in "chip"
          break;
        case 'sh':
          soundToPlay = 'sh'; // For this lesson, use plain "sh"
          break;
        // Individual letter sounds for blending
        case 's':
          soundToPlay = 'suhh'; // The "s" sound
          break;
        case 'a':
          soundToPlay = 'ack'; // Short "a" sound as in "sack"
          break;
        case 'er':
          soundToPlay = 'er';
          break;
        case 'ck':
          soundToPlay = 'kuh'; // "ck" digraph makes one "k" sound
          break;
        case 'c':
          soundToPlay = 'kuh'; // Hard "c" sound (same as k)
          break;
        case 'k':
          soundToPlay = 'kuh'; // The "k" sound
          break;
        case 'i':
          soundToPlay = 'e'; // Short "i" sound as in "kit"
          break;
        case 't':
          soundToPlay = 'tuh'; // The "t" sound
          break;
        default:
          soundToPlay = phoneme;
      }
      
      const utterance = new SpeechSynthesisUtterance(soundToPlay);
      utterance.rate = 0.5; // Even slower for clear phoneme pronunciation
      utterance.pitch = 1.1; // Slightly higher pitch for child-friendly sound
      utterance.volume = 0.9; // Clear volume for phoneme learning
      
      // Try to use a child-friendly voice if available
      const voices = window.speechSynthesis.getVoices();
      const childFriendlyVoice = voices.find(voice => 
        voice.name.toLowerCase().includes('female') || 
        voice.name.toLowerCase().includes('samantha') ||
        voice.name.toLowerCase().includes('karen')
      );
      
      if (childFriendlyVoice) {
        utterance.voice = childFriendlyVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  };

  // Reset dynamic passage when changing questions or moving away from speech questions
  useEffect(() => {
    if (!isSpeechQuestion && hasDynamicPassage) {
      setHasDynamicPassage(false);
      setDynamicSpeechPassage('');
    }
  }, [isSpeechQuestion, hasDynamicPassage]);

  // Generate dynamic speech passage when moving from adventure mode to speech questions
  useEffect(() => {
    const shouldGenerateDynamicPassage = isSpeechQuestion && storyContext.length > 0 && !hasDynamicPassage;
    if (!shouldGenerateDynamicPassage) return;

    let cancelled = false;
    const generateDynamicPassage = async () => {
      try {
        setIsDynamicPassageLoading(true);
        const contextText = storyContext.join('\n');
        const lastEvent = getLastEvent();
        const messages = [
          {
            role: 'system',
            content: `You write Kindergarten read-aloud micro-passages that are fun, playful, and tightly tied to the child’s ongoing adventure. Your success lies in keeping the passage at the right difficulty level while also contextualising it perfectly to the adventure to keep it coherent and interesting.

Inputs you may reference:
- Story snippets: the recent adventure turns below
- Most recent event: the event provided below
- Use simple aliases for complex names:
  Wise Guardian → Sparkle; mystical chamber → bakery kitchen; ancient archive → magical recipe book; magical light → glow; knowledge/wisdom → baking wisdom

Strict rules:
0) Event anchoring: Build directly on the most recent event; include at least one concrete detail from it. Do not change the location/scene or introduce unrelated new objects.
1) Audience/decodability: Kindergarten. Mostly CVC and common sight words. Strong CVC focus (short i words). Do not use difficult to speak words like bright etc., since this is a reading exercise for kindergarten students.
2) Length: EXACTLY 5 lines; each line 5–6 words; total 25–30 words.
4) Include these target words exactly: "big", "stick", "hit".
5) Keep it lively.
6) Name usage: You may use "London," "Sparkle," and "Skydiver Brother." Avoid other proper names.
8) Clarity: Very short sentences; vary stems (do not repeat the same opening more than twice).
9) Ending: Finish with a tiny hook / cliffhanger or next step (≤ 6 words), preferably a question.
10) Output format: Return ONLY the 5 lines separated by newline characters. No titles, labels, or extra text.`
          },
          {
            role: 'user',
            content: `Adventure context (most recent last):\n${contextText}\n\nMost recent event to build on:\n${lastEvent}\n\nTarget words to include exactly: red, net, deck.\n\nWrite the passage now following the rules above. Use at least one concrete detail from the most recent event, stay in the same scene, and avoid unrelated new objects or places. Return only the five lines.`
          }
        ];

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        if (!cancelled) {
          const dynamicPassage = data.reply || currentSpeechQuestion?.text || '';
          setDynamicSpeechPassage(dynamicPassage);
          setHasDynamicPassage(true);
          setIsDynamicPassageLoading(false);
        }
      } catch (error) {
        console.error('Error generating dynamic speech passage:', error);
        if (!cancelled && currentSpeechQuestion) {
          // Fallback to original passage
          setDynamicSpeechPassage(currentSpeechQuestion.text);
          setHasDynamicPassage(true);
          setIsDynamicPassageLoading(false);
        }
      }
    };

    void generateDynamicPassage();
    return () => { cancelled = true; };
  }, [isSpeechQuestion, storyContext, hasDynamicPassage, currentSpeechQuestion]);

  // Do not seed static passage into story context; keep context sourced from Step 1 and user additions only

  // Generate Long A specific passage for step 4 (gate question)
  useEffect(() => {
    if (!isLongAQuestion || !currentLongAQuestion || hasGeneratedLongAPassage) return;
    if (!storyContext.length) return;

    let cancelled = false;
    const generateLongAPassage = async () => {
      try {
        setIsLongAPassageLoading(true);
        const contextText = storyContext.join('\n');
        const lastEvent = getLastEvent();
        const targetWord = currentLongAQuestion.word; // "gate"
        const baseLine = currentLongAQuestion.aiHook?.baseLine || 'A shimmering starlight doorway appears in the cavern wall.';
        
        const messages = [
          {
            role: 'system',
            content: 'You are a warm, excited narrator for Grade 2 readers. Return exactly two sentences, no more than 11 words in total.  Sentence 1: 4–6 words reacting to the latest adventure moment. Sentence 2: 3–5 words, must contain exactly “here\’s the next clue.” Connect the sentences with a simple word like “Now” or “So.” Do not add extra description, imagery, or instructions.'
          },
          {
            role: 'user',
            content: `Adventure history (most recent last):\n${contextText}\n\nMost recent event to bridge from:\n${lastEvent}\n\nBase line to adapt:\n${baseLine}\n\nUnseen target word (do NOT say it):\n${targetWord}`
          }
        ];

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        if (!cancelled) {
          const passage = data.reply || baseLine;
          setLongAPassage(passage);
          setHasGeneratedLongAPassage(true);
          setIsLongAPassageLoading(false);
        }
      } catch (error) {
        console.error('Error generating Long A passage:', error);
        if (!cancelled && currentLongAQuestion) {
          // Fallback to base line
          const fallback = currentLongAQuestion.aiHook?.baseLine || 'A sparkling frosting doorway appears in the bakery wall. London sees magical ingredients floating through the glowing opening.';
          setLongAPassage(fallback);
          setHasGeneratedLongAPassage(true);
          setIsLongAPassageLoading(false);
        }
      }
    };

    void generateLongAPassage();
    return () => { cancelled = true; };
  }, [isLongAQuestion, currentLongAQuestion, hasGeneratedLongAPassage, storyContext]);

  // Autoplay the Long A passage once it becomes available
  useEffect(() => {
    if (!isLongAQuestion || !hasGeneratedLongAPassage || hasAutoplayedLongAPassage) return;
    const passage = longAPassage?.trim();
    if (!passage) return;
    
    try { audioManager.stopAll(); } catch {}
    setHasAutoplayedLongAPassage(true);
    setTimeout(() => { void playElevenTTS(passage); }, 300);
  }, [isLongAQuestion, hasGeneratedLongAPassage, hasAutoplayedLongAPassage, longAPassage]);

  // Note: Speech question (step 3) does not autoplay - student needs to read it themselves

  // Automatic feedback for speech questions once evaluation is finalized
  useEffect(() => {
    console.log('🔍 Auto-feedback effect triggered:', {
      isSpeechQuestion,
      hasSpeechEvaluated,
      isRecording,
      isProcessing,
      hasAutoplayedSpeechPrompt,
      speechSuccess,
      transcript: transcript?.slice(0, 50) + '...'
    });
    
    if (isSpeechQuestion && hasSpeechEvaluated && !isRecording && !isProcessing && !hasAutoplayedSpeechPrompt) {
      console.log('✅ Auto-feedback conditions met, setting hasAutoplayedSpeechPrompt=true');
      setHasAutoplayedSpeechPrompt(true);

      const speak = async () => {
        audioManager.stopAll();
        if (speechSuccess) {
          console.log('🎉 Speaking success message and setting showSpeechContinuation=true');
          await playElevenTTS('Awesome! You read the story beautifully. What do you think happens next in the adventure?');
          console.log('🔄 Setting showSpeechContinuation=true');
          setShowSpeechContinuation(true);
          try { appendEvent(`User's story addition from reading: ${transcript.slice(0, 160)}`); } catch {}
        } else {
          console.log('❌ Speaking failure message');
          await playElevenTTS('Good try! Try reading more of the story clearly.');
        }
      };
      // Add a small delay to ensure the UI has updated
      setTimeout(() => {
        void speak();
      }, 500);
    }
  }, [isSpeechQuestion, hasSpeechEvaluated, speechSuccess, isRecording, isProcessing, hasAutoplayedSpeechPrompt, transcript]);

  // Reset AI hook state when entering a hook step (4 or 5) to force regeneration
  useEffect(() => {
    if (isAiHookStep) {
      setHasGeneratedSummary(false);
      setHasAutoplayedSummary(false);
      setAiSummary('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAiHookStep, currentRegularQuestion?.id]);

  // Preserve the learner's validated continuation when returning to Step 5 later
  useEffect(() => {
    if (isFirstRegularStep && validatedContinuation) {
      setShowFeedback(true);
      setIsCorrect(true);
      setIsContinuationHidden(true);
      setIsFeedbackRemoved(false);
    }
  }, [isFirstRegularStep, validatedContinuation]);

  // Generate a brief story-forwarding hook (short sentences) when step 5/6 is active, only once unless retried
  useEffect(() => {
    const shouldSummarize = isAiHookStep && storyContext.length > 0 && !hasGeneratedSummary;
    if (!shouldSummarize) return;
    let cancelled = false;
    const run = async () => {
      try {
        setIsSummaryLoading(true);
        const targetWord = hookTargetWord;
        const lastEvent = getLastEvent();
        const questionEnding = hookQuestionLine;
        const baseLine = hookBaseLine;
        const contextText = buildContextText();
        const isCurrentLongASorting = currentLongAQuestion?.isSorting;
        const actionWord = isCurrentLongASorting ? 'sort' : 'spell';
        
        const messages = [
          {
            role: 'system',
            content:
              `You are a warm, excited narrator for Grade 2 readers. Return exactly two sentences, no more than 11 words in total.  Sentence 1: 4–6 words reacting to the latest adventure moment. Sentence 2: 3–5 words, must contain exactly “here\’s the next clue.” Connect the sentences with a simple word like “Now” or “So.” Do not add extra description, imagery, or instructions.`
          },
          {
            role: 'user',
            content: isCurrentLongASorting 
              ? `Adventure history (most recent last):\n${contextText}\n\nMost recent event to bridge from:\n${lastEvent}\n\nBase line to adapt:\n${baseLine}\n\nTask: Student will sort words by their vowel patterns (do NOT mention the specific words or patterns)`
              : `Adventure history (most recent last):\n${contextText}\n\nMost recent event to bridge from:\n${lastEvent}\n\nBase line to adapt:\n${baseLine}\n\nUnseen target word (do NOT say it):\n${targetWord}`
          }
        ];
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages })
        });
        const data = await res.json();
        if (!cancelled) {
          const summary = (data.reply || '').trim() || (isFirstRegularStep
            ? '"Look! The sparkling bakery paths stretch endlessly," whispers Sparkle. "Here\'s a clue, London: listen and type where we\'re traveling," echoes through the enchanted kitchen.'
            : '"The bakery whispers with magic," says Sparkle. "Here\'s a clue, London: listen and type the magical word," resonates through the glowing ovens.');
          setAiSummary(summary);
          try { setHookForStep('3', summary); } catch {}
          setHasGeneratedSummary(true);
        }
      } catch {
        if (!cancelled) {
          setAiSummary(isFirstRegularStep
            ? '"Look! The sparkling bakery paths stretch endlessly," whispers Sparkle. "Here\'s a clue, London: listen and type where we\'re traveling," echoes through the enchanted kitchen.'
            : '"The bakery whispers with magic," says Sparkle. "Here\'s a clue, London: listen and type the magical word," resonates through the glowing ovens.');
          setHasGeneratedSummary(true);
        }
      } finally {
        if (!cancelled) setIsSummaryLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [isAiHookStep, isFirstRegularStep, hasGeneratedSummary, storyContext, validatedContinuation, isSecondRegularStep, hookTargetWord, hookQuestionLine, hookBaseLine]);

  // Helper: ElevenLabs TTS
  const playElevenTTS = async (text: string, voiceId?: string, speed?: number): Promise<HTMLAudioElement | null> => {
    try {
      // Always preempt any current audio before starting new
      audioManager.stopAll();
      const res = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_id: voiceId, speed })
      });
      if (!res.ok) return null;
      const data = await res.json();
      const audio = new Audio(data.audioUrl as string);
      
      // Apply playback rate if speed is specified and different from 1.0
      if (speed && speed !== 1.0) {
        audio.playbackRate = speed;
      }
      
      audioManager.setActive(audio);
      audio.onended = () => {
        if (summaryAudioRef.current === audio) setIsSummarySpeaking(false);
        if (currentElevenLabelRef.current === text) currentElevenLabelRef.current = null;
      };
      audio.onpause = () => {
        if (summaryAudioRef.current === audio) setIsSummarySpeaking(false);
      };
      await audio.play().catch(() => undefined);
      return audio;
    } catch {
      return null;
    }
  };

  const handleSummaryAudio = async () => {
    // For Long A questions, use Long A passage instead of aiSummary
    if (isLongAQuestion) {
      if (!longAPassage) return;
      // Toggle: stop existing audio
      if (summaryAudioRef.current && !summaryAudioRef.current.paused) {
        try { summaryAudioRef.current.pause(); summaryAudioRef.current.currentTime = 0; } catch {}
        setIsSummarySpeaking(false);
        return;
      }
      // Preempt any other audio before playing
      audioManager.stopAll();
      const textToSpeak = longAPassage.trim();
      setIsSummarySpeaking(true);
      const audio = await playElevenTTS(textToSpeak);
      if (audio) {
        summaryAudioRef.current = audio;
        audio.onended = () => setIsSummarySpeaking(false);
        audio.onerror = () => setIsSummarySpeaking(false);
      } else {
        setIsSummarySpeaking(false);
      }
      return;
    }

    // For regular questions, use aiSummary
    if (!aiSummary) return;
    // Toggle: stop existing audio
    if (summaryAudioRef.current && !summaryAudioRef.current.paused) {
      try { summaryAudioRef.current.pause(); summaryAudioRef.current.currentTime = 0; } catch {}
      setIsSummarySpeaking(false);
      return;
    }
    // Preempt any other audio before playing
    audioManager.stopAll();
    const textToSpeak = aiSummary.trim();
    setIsSummarySpeaking(true);
    const audio = await playElevenTTS(textToSpeak);
    if (audio) {
      summaryAudioRef.current = audio;
      audio.onended = () => setIsSummarySpeaking(false);
      audio.onerror = () => setIsSummarySpeaking(false);
    } else {
      setIsSummarySpeaking(false);
    }
  };

  // When the continuation step becomes active (after correct answer), seed the header text (AI-generated with context)
  useEffect(() => {
    if (isCorrect && isContinuationStep) {
      let cancelled = false;
      const defaultLine = isFirstRegularStep
        ? `Yay, "${hookTargetWord}" it is. What adventures await in this vast ${hookTargetWord}? Let\'s include it in your story`
        : `Let\'s keep the story going—add your next line!`;

      const run = async () => {
        try {
          setIsContinuationHeaderLoading(true);
          const contextText = buildContextText();
          const lastEvent = getLastEvent();
          const baseLine = hookBaseLine;
          const isCurrentLongASorting = currentLongAQuestion?.isSorting;
          const actionType = isCurrentLongASorting ? 'sorted' : 'spelled';
          const taskDescription = isCurrentLongASorting ? 'sorting the words by their vowel patterns' : `spelling "${hookTargetWord}"`;
          
          const messages = [
            {
              role: 'system',
              content: `You are a warm, enthusiastic narrator for Grade 2 readers. Write exactly 2 short sentences (maximum 14 words total). The first sentence should celebrate their correct ${actionType === 'sorted' ? 'sorting' : 'spelling'} with 2–3 words (e.g., “Perfect!” or “Yes!”) plus one emoji. The second sentence should give a direct, simple instruction: ask them to use ${hookTargetWord} (or one of the ${taskDescription} words) to describe what happens next, using phrasing like “Try using ${hookTargetWord} to describe what happens next” or “How would you use ${hookTargetWord} to describe what happens next?”. Do not add any extra scene description or story details.`
            },
            {
              role: 'user',
              content: `They just ${actionType} ${isCurrentLongASorting ? 'the words by vowel patterns' : `"${hookTargetWord}"`} correctly!\n\nStory context:\n${contextText}\n\nRecent scene:\n${lastEvent}\n\nQuestion scene:\n${baseLine}\n\nCelebrate, briefly reference the immediate scene, and ask them to use one word to describe what happens next.`
            }
          ];
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages })
          });
          if (!cancelled) {
            if (!res.ok) {
              setContinuationHeader(defaultLine);
              setIsContinuationHeaderLoading(false);
              return;
            }
            const data = await res.json();
            const line = (data.reply || '').trim();
            setContinuationHeader(line || defaultLine);
            setIsContinuationHeaderLoading(false);
          }
        } catch {
          if (!cancelled) {
            setContinuationHeader(defaultLine);
            setIsContinuationHeaderLoading(false);
          }
        }
      };

      // Clear first and set loading state
      setContinuationHeader('');
      void run();
      return () => { cancelled = true; };
    }
  }, [isCorrect, isContinuationStep, isFirstRegularStep, hookTargetWord, hookBaseLine]);

  // Autoplay the continuation guidance once when the AI-generated header is ready
  useEffect(() => {
    if (isCorrect && isContinuationStep && !isContinuationHidden && !hasAutoplayedContPrompt && continuationHeader) {
      setHasAutoplayedContPrompt(true);
      audioManager.stopAll();
      void playElevenTTS(continuationHeader);
    }
  }, [isCorrect, isContinuationStep, isContinuationHidden, hasAutoplayedContPrompt, continuationHeader]);

  // Autoplay AI-generated summary for all regular questions with aiHook when entering step
  useEffect(() => {
    if (isAiHookStep && aiSummary && !hasAutoplayedSummary && currentRegularQuestion) {
      audioManager.stopAll();
      const run = async () => {
        const textToSpeak = aiSummary.trim();
        await playElevenTTS(textToSpeak);
        setHasAutoplayedSummary(true);
      };
      void run();
    }
  }, [isAiHookStep, aiSummary, hasAutoplayedSummary, currentRegularQuestion]);

  // Evaluate continuation via AI with richer outcomes
  type ContinuationEval = { status: 'valid' | 'invalid' | 'help'; message: string };
  const validateContinuationWithAI = async (text: string): Promise<ContinuationEval> => {
    try {
      const isCurrentLongASorting = currentLongAQuestion?.isSorting;
      const sortingWords = currentLongAQuestion?.sortingWords || [];
      const targetWord = isCurrentLongASorting ? 'one of the sorting words' : hookValidationWord;
      
      let validationInstructions: string;
      if (isCurrentLongASorting && sortingWords.length > 0) {
        validationInstructions = `You are London's fun AI companion helping kids write their magical bakery adventure story. Your job is to check if they used one of these sorting words: ${sortingWords.join(', ')} in their sentence and respond naturally like a friendly narrator. 

Respond as minified JSON: {"status":"valid|invalid|help","message":"<your response>"}

RULES:
- "valid": If ANY of these words (${sortingWords.join(', ')}) appears in any form (case-insensitive) - including within contractions, compound words, or with punctuation. Say something encouraging like "Perfect!" or "Great use of [word they used]!" 
- "invalid": If they used a completely different word or clearly misspelled it, gently point out what they wrote and what you need. Be specific: "I see you wrote '[their word]' but I need one of these words: ${sortingWords.join(', ')}. Try again!"`;
      } else {
        validationInstructions = `You are London's fun AI companion helping kids write their magical bakery adventure story. Your job is to check if they used the target word "${hookValidationWord}" in their sentence and respond naturally like a friendly narrator. 

Respond as minified JSON: {"status":"valid|invalid|help","message":"<your response>"}

RULES:
- "valid": If the word "${hookValidationWord}" appears in any form (case-insensitive) - including within contractions, compound words, or with punctuation. Say something encouraging like "Perfect!" or "Great use of ${hookValidationWord}!" 
- "invalid": If they used a completely different word or clearly misspelled it, gently point out what they wrote and what you need. Be specific: "I see you wrote '[their word]' but I need the word '${hookValidationWord}'. Try again!"`;
      }
      
      const messages = [
        { role: 'system', content: validationInstructions + `
- "help": If they ask for help or seem stuck, give a creative prompt about what the word(s) could do in the adventure.

Be conversational, not scripted. Acknowledge what they actually wrote. Keep responses under 25 words.` },
        { role: 'user', content: isCurrentLongASorting && sortingWords.length > 0 
          ? `Sentence: ${text}\n\nCurrent story context: ${storyContext.join(' ')}\n\nHelp the child continue London's magical bakery adventure using one of these words: ${sortingWords.join(', ')}.`
          : `Sentence: ${text}\n\nCurrent story context: ${storyContext.join(' ')}\n\nHelp the child continue London's magical bakery adventure using the word "${hookValidationWord}".` }
      ];
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });
      const data = await res.json();
      const raw: string = (data.reply || '').trim();
      let parsed: ContinuationEval | null = null;
      
      // Enhanced JSON parsing with better error handling
      try { 
        parsed = JSON.parse(raw) as ContinuationEval; 
      } catch (parseError) {
        console.log('JSON parse failed for AI response:', raw, 'Error:', parseError);
        // Try to extract status and message from malformed JSON
        const statusMatch = raw.match(/"status"\s*:\s*"(valid|invalid|help)"/i);
        const messageMatch = raw.match(/"message"\s*:\s*"([^"]+)"/i);
        if (statusMatch && messageMatch && statusMatch[1] && messageMatch[1]) {
          parsed = { status: statusMatch[1] as 'valid' | 'invalid' | 'help', message: messageMatch[1] };
          console.log('Recovered from malformed JSON:', parsed);
        }
      }
      
      if (parsed && parsed.status && parsed.message) return parsed;
      
      // Enhanced fallback validation - more flexible word detection
      const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, ' '); // Replace punctuation with spaces
      
      if (isCurrentLongASorting && sortingWords.length > 0) {
        // For sorting questions, check if any of the sorting words appears
        const foundSortingWord = sortingWords.find(word => {
          const normalizedSortingWord = word.toLowerCase();
          if (normalizedText.includes(normalizedSortingWord)) {
            return true;
          }
          
          // Check for similar words allowing minor typos
          const words = normalizedText.split(/\s+/);
          return words.some(textWord => {
            const minLength = Math.min(textWord.length, normalizedSortingWord.length);
            if (minLength < 2) return false;
            
            let differences = 0;
            const maxDifferences = normalizedSortingWord.length > 2 ? 1 : 0;
            
            for (let i = 0; i < Math.max(textWord.length, normalizedSortingWord.length); i++) {
              if (textWord[i] !== normalizedSortingWord[i]) {
                differences++;
                if (differences > maxDifferences) return false;
              }
            }
            return differences <= maxDifferences;
          });
        });
        
        if (foundSortingWord) {
          return { status: 'valid', message: 'Great!' };
        }
      } else {
        // For regular questions, check the target word
        const normalizedTargetWord = hookValidationWord.toLowerCase();
        
        // Check if target word appears anywhere in the normalized text
        if (normalizedText.includes(normalizedTargetWord)) {
          return { status: 'valid', message: 'Great!' };
        }
        
        // Check for common misspellings or similar words
        const words = normalizedText.split(/\s+/);
        const similarWord = words.find(word => {
          // Check if word is very similar (allowing for minor typos)
          const minLength = Math.min(word.length, normalizedTargetWord.length);
          if (minLength < 2) return false;
          
          // Simple similarity check - allow 1 character difference for words > 2 chars
          let differences = 0;
          const maxDifferences = normalizedTargetWord.length > 2 ? 1 : 0;
          
          for (let i = 0; i < Math.max(word.length, normalizedTargetWord.length); i++) {
            if (word[i] !== normalizedTargetWord[i]) {
              differences++;
              if (differences > maxDifferences) return false;
            }
          }
          return differences <= maxDifferences;
        });
        
        if (similarWord) {
          return { status: 'valid', message: 'Great!' };
        }
      }
      
      if (/help|hint|example|idk|don\'?t know/i.test(text)) {
        if (isCurrentLongASorting && sortingWords.length > 0) {
          return { status: 'help', message: `No worries! Pick one of these words and tell what London might do: ${sortingWords.join(', ')}` };
        } else {
          return { status: 'help', message: `No worries! What if London's ${hookValidationWord} could help her explore the magical bakery? How might she use it?` };
        }
      }
      
      if (isCurrentLongASorting && sortingWords.length > 0) {
        return { status: 'invalid', message: `Use one of these words in your sentence: ${sortingWords.join(', ')}` };
      } else {
        return { status: 'invalid', message: `Use the word "${hookValidationWord}" in your sentence.` };
      }
    } catch (error) {
      console.error('Validation error:', error);
      const isCurrentLongASorting = currentLongAQuestion?.isSorting;
      const sortingWords = currentLongAQuestion?.sortingWords || [];
      
      if (isCurrentLongASorting && sortingWords.length > 0) {
        return { status: 'help', message: `Try using one of these words: ${sortingWords.join(', ')}` };
      } else {
        return { status: 'help', message: `Try using the word "${hookValidationWord}"` };
      }
    }
  };

  const handleSubmitContinuation = async () => {
    const text = continuationInput.trim();
    if (!text) return;
      setValidationMessage('');
    const result = await validateContinuationWithAI(text);
    
    // Always allow continuation regardless of target word usage
    // Show encouraging message for valid usage, but still proceed for invalid
    if (result.status === 'valid') {
      setValidationMessage(result.message || 'Great!');
    } else if (result.status === 'invalid') {
      setValidationMessage(result.message || 'Nice story continuation!');
    } else {
      const isCurrentLongASorting = currentLongAQuestion?.isSorting;
      const sortingWords = currentLongAQuestion?.sortingWords || [];
      
      let defaultHelpMsg: string;
      if (isCurrentLongASorting && sortingWords.length > 0) {
        defaultHelpMsg = `Great story! Next time try using one of these words: ${sortingWords.join(', ')}`;
      } else {
        defaultHelpMsg = `Nice continuation! Next time consider using the word "${hookValidationWord}"`;
      }
      
      const msg = result.message || defaultHelpMsg;
      setValidationMessage(msg);
    }
    
    // Always proceed with continuation
    setValidatedContinuation(text);
    setStoryContext(prev => [...prev, text]);
    setContinuationInput('');
    // Immediately animate out (no added wait, no praise TTS)
      setIsContinuationHidden(true);
    setIsFeedbackRemoved(false);
    try { appendEvent(`User's continuation (Step 4): ${text}`); } catch {} // Store for AdventureMode story summaries
    try { setPendingAdventureChat(text); } catch {}
    // Auto-advance to Step 5 after a short beat
    // Reset step-level UI state to avoid bleed into Step 5
    setShowFeedback(false);
    setIsCorrect(false);
    setSelectedOption(null);
    setSpellingInput('');
    setHasAutoplayedContPrompt(false);
    setContinuationHeader('');
    setValidationMessage('');
    setIsContinuationHidden(false);
    setHasGeneratedSummary(false);
    setAiSummary('');
    setIsSummaryLoading(true);
    setTimeout(() => {
      setCurrentQuestionIndex(prev => prev + 1);
    }, 600);
    // Also eager-prime the next hook (Step 6) after Step 5 user chat lands,
    // the regular flow will regenerate from updated storyContext.
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  };

  // Image flow: start from the student's continuation input
  const startImageFromContinuation = async () => {
    // FEATURE FLAG: Disable continuation image generation
    if (!ENABLE_CONTINUATION_IMAGE_GENERATION) {
      console.log('Continuation image generation is disabled');
      return;
    }
    
    const raw = continuationInput.trim();
    if (!raw) return;
    // Seed description directly from user text (can be refined later by LLM)
    setImageDescription(raw);
    setImageUrl(null);
    setImageError(null);
    setIsImageStepActive(true);
    setImageFlowSource('regular');
    // Immediately trigger generation for a smooth, single-step flow
    void generateImageFromDescription(raw);
  };

  // Image flow: start from the speech continuation input
  const startImageFromSpeechContinuation = async () => {
    // FEATURE FLAG: Disable continuation image generation
    if (!ENABLE_CONTINUATION_IMAGE_GENERATION) {
      console.log('Speech continuation image generation is disabled');
      return;
    }
    
    const raw = speechContinuationInput.trim();
    if (!raw) return;
    setImageDescription(raw);
    setImageUrl(null);
    setImageError(null);
    setIsImageStepActive(true);
    setImageFlowSource('speech');
    void generateImageFromDescription(raw);
  };

  // Generate image from current imageDescription using the image API
  const generateImageFromDescription = async (overridePrompt?: string) => {
    const rawPrompt = (overridePrompt ?? imageDescription).trim();
    if (!rawPrompt) return;
    
    // Build context-aware prompt by incorporating story context and latest events
    const storyContext = buildContextText();
    const latestEvent = getLastEvent();
    const latestMeaningfulEvent = getLatestMeaningfulEvent();
    
    // Create a rich, contextual prompt that includes story background
    let contextualPrompt = rawPrompt;
    
    if (latestMeaningfulEvent || latestEvent || storyContext) {
      const contextParts = [];
      
      if (latestMeaningfulEvent) {
        contextParts.push(`Latest story development: ${latestMeaningfulEvent}`);
      } else if (latestEvent) {
        contextParts.push(`Current story context: ${latestEvent}`);
      }
      
      if (storyContext && !latestEvent?.includes(storyContext.slice(-100))) {
        contextParts.push(`Story background: ${storyContext.slice(-200)}`);
      }
      
      const contextText = contextParts.join('. ');
      contextualPrompt = `${contextText}. User's image request: ${rawPrompt}. Create an image that fits seamlessly into this ongoing magical bakery adventure story.`;
    }
    
    // Log user-generated image details
    console.log('=== QUESTION PANEL USER IMAGE GENERATION ===');
    console.log('Function: QuestionPanel.generateImageFromDescription');
    console.log('Raw prompt:', rawPrompt);
    console.log('Override prompt:', overridePrompt);
    console.log('Story context:', storyContext);
    console.log('Latest event:', latestEvent);
    console.log('Latest meaningful event:', latestMeaningfulEvent);
    console.log('Final contextual prompt:', contextualPrompt);
    console.log('==========================================');
    
    try {
      setImageLoading(true);
      setImageError(null);
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: contextualPrompt })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to generate image');
      }
      const data = await res.json();
      const url = (data?.imageUrl || '').trim();
      if (!url) throw new Error('No image returned');
      setImageUrl(url);
      // Persist lightweight event so the story can reference this image
      try { appendEvent(`Image created: ${rawPrompt}`); } catch {}
    } catch (err: any) {
      setImageError(err?.message || 'Failed to generate image. Please try again.');
    } finally {
      setImageLoading(false);
    }
  };

  // Close image flow and continue the story using the same input
  const continueAfterImage = async () => {
    // Treat the image path as acceptance of the user's text; record and advance
    if (imageFlowSource === 'speech') {
      const text = speechContinuationInput.trim();
      if (text) {
        try { appendEvent(`User's story addition (Speech): ${text}`); } catch {}
        setStoryContext(prev => [...prev, `User's story addition: ${text}`]);
        setSpeechContinuationInput('');
        setShowSpeechContinuation(false);
        try { setPendingAdventureChat(text); } catch {}
      }
    } else {
      const text = continuationInput.trim();
      if (text) {
        try { appendEvent(`User's continuation (Step 4): ${text}`); } catch {} // Store for AdventureMode story summaries
        setValidatedContinuation(text);
        setStoryContext(prev => [...prev, text]);
        try { setPendingAdventureChat(text); } catch {}
      }
    }
    // Ensure Step 5 regenerates fresh summary from the new continuation
    setHasGeneratedSummary(false);
    setHasAutoplayedSummary(false);
    setAiSummary('');
    setIsSummaryLoading(true);
    // Reset Step 4 UI-specific flags just like the non-image path
    setShowFeedback(false);
    setIsCorrect(false);
    setSelectedOption(null);
    setSpellingInput('');
    setHasAutoplayedContPrompt(false);
    setContinuationHeader('');
    setValidationMessage('');
    setIsContinuationHidden(false);
    setIsFeedbackRemoved(false);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    setIsImageStepActive(false);
    // Move forward to the next step immediately
    handleNextQuestion();
  };

  // Speech-to-text for image prompt editing (lightweight Web Speech API)
  const startImagePromptRecording = () => {
    try {
      const SpeechRecognition: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      // Reset previous text when speaking begins
      let accumulated: string = '';
      setImageDescription('');
      recognition.onresult = (event: any) => {
        let interim = '';
        let newFinal = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) newFinal += res[0].transcript + ' ';
          else interim += res[0].transcript;
        }
        if (newFinal) accumulated += newFinal;
        setImageDescription((accumulated + interim).trimStart());
      };
      recognition.onend = () => { setIsImageRecording(false); setImageRecognition(null); };
      recognition.onerror = () => { setIsImageRecording(false); setImageRecognition(null); };
      recognition.start();
      setIsImageRecording(true);
      setImageRecognition(recognition);
    } catch {
      setIsImageRecording(false);
    }
  };

  const stopImagePromptRecording = () => {
    try { const rec = imageRecognition; if (rec) rec.stop(); } catch {}
    setIsImageRecording(false);
    setImageRecognition(null);
  };

  // Speech-to-text for speech continuation "what happens next" input
  const startSpeechContRecording = () => {
    try {
      const SpeechRecognition: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      let accumulated: string = speechContinuationInput || '';
      recognition.onresult = (event: any) => {
        let interim = '';
        let newFinal = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) newFinal += res[0].transcript + ' ';
          else interim += res[0].transcript;
        }
        if (newFinal) accumulated += newFinal;
        setSpeechContinuationInput((accumulated + interim).trimStart());
      };
      recognition.onend = () => { setIsSpeechContRecording(false); setSpeechContRecognition(null); };
      recognition.onerror = () => { setIsSpeechContRecording(false); setSpeechContRecognition(null); };
      recognition.start();
      setIsSpeechContRecording(true);
      setSpeechContRecognition(recognition);
    } catch {
      setIsSpeechContRecording(false);
    }
  };

  const stopSpeechContRecording = () => {
    try { const rec = speechContRecognition; if (rec) rec.stop(); } catch {}
    setIsSpeechContRecording(false);
    setSpeechContRecognition(null);
  };

  const handleSubmitSpeechContinuation = async () => {
    const text = speechContinuationInput.trim();
    if (!text) return;
    
    setSpeechValidationMessage('Great story addition!');
    // Add user's story continuation to context with clear labeling
    const userStoryAddition = `User's story addition: ${text}`;
    setStoryContext(prev => [...prev, userStoryAddition]);
    setSpeechContinuationInput('');
    setShowSpeechContinuation(false);
    
    // Add to story and continue
    void playElevenTTS('Perfect! Your story continues beautifully.');
    
    // Auto-advance after a short delay
    setTimeout(() => {
      handleNextQuestion();
    }, 2000);
  };

  // Voice recording handlers for continuation input (no Whisper; live recognition only)
  // Prefer Whisper: record audio and send to STT endpoint; also keep interim Web Speech in case
  const startContinuationRecording = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    // Start interim recognition if available
    let recognition: any = null;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
    }
    // Stop any playing audio before recording to avoid feedback
    audioManager.stopAll();
    // Start media recorder for Whisper
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          setIsContProcessing(true);
          const formData = new FormData();
          formData.append('audio', blob, 'continuation.webm');
          const resp = await fetch('/api/speech-to-text', { method: 'POST', body: formData });
          if (resp.ok) {
            const data = await resp.json();
            const text = (data.transcript || '').trim();
            if (text) setContinuationInput(prev => (prev ? (prev + ' ' + text).trim() : text));
          }
        } catch {}
        finally {
          setIsContProcessing(false);
          stream.getTracks().forEach(t => t.stop());
        }
      };
      recorder.start();
      setContMediaRecorder(recorder);
    } catch (err) {
      console.warn('Mic error for Whisper recording', err);
    }
    // Accumulate final chunks to avoid overwriting on pauses
    let accumulated = continuationInput || '';
    if (recognition) {
      recognition.onresult = (event: any) => {
        let interim = '';
        let newFinal = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) newFinal += res[0].transcript + ' ';
          else interim += res[0].transcript;
        }
        if (newFinal) {
          accumulated = (accumulated + ' ' + newFinal).replace(/\s+/g, ' ').trim() + ' ';
        }
        const display = (accumulated + interim).replace(/\s+/g, ' ').trim();
        setContinuationInput(display);
      };
      recognition.onerror = () => { setIsContRecording(false); };
      recognition.onend = () => { setIsContRecording(false); setContRecognition(null); };
      recognition.start();
      setContRecognition(recognition);
    }
    setIsContRecording(true);
  };

  const stopContinuationRecording = () => {
    if (contRecognition) {
      try { contRecognition.stop(); } catch {}
      setContRecognition(null);
    }
    if (contMediaRecorder) {
      try { contMediaRecorder.stop(); } catch {}
      setContMediaRecorder(null);
    }
    setIsContRecording(false);
  };

  const handleOptionClick = (index: number) => {
    setSelectedOption(index);
    setShowFeedback(false); // Reset feedback when selecting new option
    
    // Play the phoneme sound when option is clicked
      const clickedPhoneme = options[index];
      if (clickedPhoneme) {
        handlePhonemeSound(clickedPhoneme);
    }
  };

  // Handle Hear button - play the complete word
  const handleHearWord = () => {
    if (!('speechSynthesis' in window)) return;
    // Toggle off if currently speaking
    if (window.speechSynthesis.speaking || isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (currentBlendingQuestion) {
      const utterance = new SpeechSynthesisUtterance(currentBlendingQuestion.word);
      utterance.rate = 0.8; // Clear pronunciation
      utterance.pitch = 1.1; // Child-friendly pitch
      utterance.volume = 0.9;

      const voices = window.speechSynthesis.getVoices();
      const childFriendlyVoice = voices.find(voice =>
        voice.name.toLowerCase().includes('female') ||
        voice.name.toLowerCase().includes('samantha') ||
        voice.name.toLowerCase().includes('karen')
      );
      if (childFriendlyVoice) utterance.voice = childFriendlyVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Handle Blend button - play individual phonemes with pauses and highlighting
  const handleBlendSounds = () => {
    if (currentBlendingQuestion && 'speechSynthesis' in window) {
      setCurrentPhonemeIndex(-1); // Reset highlighting
      
      currentBlendingQuestion.phonemes.forEach((phoneme, index) => {
        setTimeout(() => {
          setCurrentPhonemeIndex(index); // Highlight current letter
          handlePhonemeSound(phoneme);
          
          // Clear highlight after the sound finishes
          setTimeout(() => {
            if (index === currentBlendingQuestion.phonemes.length - 1) {
              setCurrentPhonemeIndex(-1); // Clear highlight after last sound
            }
          }, 600);
        }, index * 1000); // 1000ms delay between each sound for better timing
      });
    }
  };

  // Blending recording functions (similar to speech question)
  const startBlendingRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        setBlendingAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        // Auto-process to simplify UI (no separate submit needed)
        processBlendingAudio(audioBlob);
      };

      setBlendingMediaRecorder(recorder);
      recorder.start();
      setIsBlendingRecording(true);
      setBlendingRealtimeTranscript('');
      setBlendingTranscript('');

      // Start real-time speech recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }
          
          setBlendingRealtimeTranscript(interimTranscript || finalTranscript);
        };
        
        recognition.onerror = (event: any) => {
          console.error('Blending speech recognition error:', event.error);
        };
        
        setBlendingRecognition(recognition);
        recognition.start();
      }
    } catch (error) {
      console.error('Error starting blending recording:', error);
      alert('Error accessing microphone. Please check permissions.');
    }
  };

  const stopBlendingRecording = () => {
    if (blendingMediaRecorder && isBlendingRecording) {
      blendingMediaRecorder.stop();
      setIsBlendingRecording(false);
      
      if (blendingRecognition) {
        blendingRecognition.stop();
      }
    }
  };

  // Reset the blending session state so the learner can try again
  const resetBlendingSession = () => {
    if (isBlendingRecording) {
      stopBlendingRecording();
    }
    setBlendingTranscript('');
    setBlendingRealtimeTranscript('');
    setBlendingAudioBlob(null);
    setIsBlendingProcessing(false);
  };

  // Process blending audio (similar to speech question)
  const processBlendingAudio = async (blobOverride?: Blob) => {
    const blobToProcess = blobOverride || blendingAudioBlob;
    if (!blobToProcess) return;

    setIsBlendingProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', blobToProcess, 'blending_recording.wav');

      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[blending] Final transcript received:', data.transcript);
      setBlendingTranscript(data.transcript || '');
    } catch (error) {
      console.error('Error processing blending audio:', error);
      alert('Error processing audio. Please try again.');
    } finally {
      setIsBlendingProcessing(false);
    }
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        // Auto-process to simplify UI (no separate submit needed)
        processAudio(blob);
      };

      // Start recording as single continuous stream (like other working steps)
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setTranscript('');
      setRealtimeTranscript('');
      console.log('🔄 Resetting hasSpeechEvaluated=false and hasAutoplayedSpeechPrompt=false');
      setHasSpeechEvaluated(false);
      setHasAutoplayedSpeechPrompt(false);

      // Start real-time speech recognition
      startRealtimeSpeechRecognition();
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not start recording. Please check your microphone permissions.');
    }
  };

  const startRealtimeSpeechRecognition = () => {
    // Check if Web Speech API is supported
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      // Keep track of accumulated final transcript
      let accumulatedTranscript = '';
      
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
        
        // Add new final results to accumulated transcript
        if (newFinalTranscript) {
          accumulatedTranscript += newFinalTranscript;
        }
        
        // Display accumulated final + current interim
        const displayTranscript = (accumulatedTranscript + interimTranscript).trim();
        setRealtimeTranscript(displayTranscript);
        // Auto-stop if we have enough final speech and input has paused
        try { if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current); } catch {}
        silenceTimerRef.current = window.setTimeout(() => {
          if (displayTranscript.length > 0 && isRecording) {
            stopRecording();
          }
        }, 1500) as unknown as number;
      };
      
      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        // Restart recognition if it fails (unless recording has stopped)
        if (isRecording && event.error !== 'aborted') {
          setTimeout(() => {
            try {
              recognition.start();
            } catch (e) {
              console.warn('Could not restart speech recognition');
            }
          }, 1000);
        }
      };
      
      recognition.onend = () => {
        console.log('Speech recognition ended');
        // Automatically restart recognition if recording is still active
        if (isRecording) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch (e) {
              console.warn('Could not restart speech recognition');
            }
          }, 100);
        }
      };
      
      recognition.start();
      setSpeechRecognition(recognition);
    } else {
      console.warn('Web Speech API not supported in this browser');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
    
    // Stop real-time speech recognition
    if (speechRecognition) {
      speechRecognition.stop();
      setSpeechRecognition(null);
    }
  };

  const processAudio = async (blobOverride?: Blob) => {
    const blobToProcess = blobOverride || audioBlob;
    if (!blobToProcess) return;

    setIsProcessing(true);
    
    try {
      // Rely exclusively on OpenAI Whisper for evaluation
      console.log('Processing with OpenAI Whisper for final transcript...');
      const formData = new FormData();
      formData.append('audio', blobToProcess, 'recording.webm');

      const response = await fetch('http://localhost:3000/api/speech-to-text', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        const whisperTranscript = result.transcript?.trim() || '';
        console.log('✅ Whisper transcript received:', whisperTranscript);
        
        // Evaluate immediately with Whisper result (no debouncing needed)
        setTranscript(whisperTranscript);
        const success = checkSpeechSuccess(whisperTranscript);
        console.log('🔬 Whisper-only evaluation:', {
          transcript: whisperTranscript,
          success,
          expectedWords: currentSpeechQuestion?.expectedWords
        });
        
        setSpeechSuccess(success);
        
        // Generate hint if needed (but don't auto-play)
        if (!success && currentSpeechQuestion) {
          generateSpeechHint(whisperTranscript);
        } else {
          setSpeechHint('');
        }
        
        console.log('📝 Setting hasSpeechEvaluated=true (Whisper-only)');
        setHasSpeechEvaluated(true);
        setIsProcessing(false);
      } else {
        // Whisper failed - don't evaluate, ask user to retry
        const errorData = await response.text();
        console.error('❌ Whisper API failed:', response.status, errorData);
        setIsProcessing(false);
        alert('Speech recognition failed. Please try recording again.');
        return;
      }
    } catch (error) {
      console.error('❌ Error processing audio:', error);
      setIsProcessing(false);
      alert('Speech recognition failed. Please try recording again.');
      return;
    }
  };

  const handleSubmit = () => {
    if (isBlendingQuestion) {
      // For blending questions, always advance (no right/wrong)
      handleNextQuestion();
    } else if (currentLongAQuestion) {
      if (currentLongAQuestion.isSorting) {
        // For sorting questions, check if words are in correct bins
        const correctAnswer = currentLongAQuestion.correctAnswer as {[key: string]: string[]};
        let correct = true;
        
        // Check if all bins have the correct words
        for (const [binLabel, expectedWords] of Object.entries(correctAnswer)) {
          const actualWords = sortingAnswers[binLabel] || [];
          if (actualWords.length !== expectedWords.length || 
              !expectedWords.every(word => actualWords.includes(word))) {
            correct = false;
            break;
          }
        }
        
        setIsCorrect(correct);
        setShowFeedback(true);
        if (!correct) {
          void generateIncorrectHint({
            targetWord: 'sorting',
            studentAnswer: Object.entries(sortingAnswers).map(([bin, words]) => `${bin}: ${words.join(', ')}`).join('; '),
            theme: 'adventure',
            isSorting: true,
            sortingWords: currentLongAQuestion.sortingWords,
            correctSortingAnswer: correctAnswer
          });
        } else {
          setIncorrectHint('');
        }
      } else if (currentLongAQuestion.isSpelling) {
        // For long A spelling questions, check the input text
        const correct = spellingInput.toLowerCase().trim() === (currentLongAQuestion.correctAnswer as string).toLowerCase();
        setIsCorrect(correct);
        setShowFeedback(true);
        if (!correct) {
          void generateIncorrectHint({
            targetWord: String(currentLongAQuestion.correctAnswer || currentLongAQuestion.word || ''),
            studentAnswer: spellingInput,
            theme: 'adventure'
          });
        } else {
          setIncorrectHint('');
        }
      } else if (currentLongAQuestion.isFillBlank) {
        // For fill-in-the-blank questions, reconstruct the complete word from pattern and user input
        const pattern = currentLongAQuestion.fillBlankPattern || '';
        let reconstructedWord = '';
        let inputIndex = 0;
        
        for (const char of pattern) {
          if (char === '_') {
            reconstructedWord += spellingInput[inputIndex] || '';
            inputIndex++;
          } else {
            reconstructedWord += char;
          }
        }
        
        const correct = reconstructedWord.toLowerCase().trim() === (currentLongAQuestion.correctAnswer as string).toLowerCase();
        setIsCorrect(correct);
        setShowFeedback(true);
        if (!correct) {
          void generateIncorrectHint({
            targetWord: String(currentLongAQuestion.correctAnswer || currentLongAQuestion.word || ''),
            studentAnswer: reconstructedWord,
            theme: 'adventure'
          });
        } else {
          setIncorrectHint('');
        }
      } else if (selectedOption !== null) {
        // For long A multiple choice questions, check the selected option
        const correct = selectedOption === currentLongAQuestion.correctAnswer;
        setIsCorrect(correct);
        setShowFeedback(true);
        // Ensure feedback is visible
        try { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); } catch {}
        if (!correct) {
          void generateIncorrectHint({
            targetWord: String(currentLongAQuestion.correctAnswer || currentLongAQuestion.word || ''),
            studentAnswer: spellingInput || String(selectedOption),
            theme: 'adventure'
          });
        } else {
          setIncorrectHint('');
        }
      }

    } else if (currentRegularQuestion) {
      if (currentRegularQuestion.isSpelling) {
        // For spelling questions, check the input text
        const correct = spellingInput.toLowerCase().trim() === (currentRegularQuestion.correctAnswer as string).toLowerCase();
        setIsCorrect(correct);
        setShowFeedback(true);
        if (!correct) {
          void generateIncorrectHint({
            targetWord: String(currentRegularQuestion.correctAnswer || currentRegularQuestion.word || ''),
            studentAnswer: spellingInput,
            theme: 'adventure'
          });
        } else {
          setIncorrectHint('');
        }
      } else if (currentRegularQuestion.isFillBlank) {
        // For fill-in-the-blank questions, reconstruct the complete word from pattern and user input
        const pattern = currentRegularQuestion.fillBlankPattern || '';
        let reconstructedWord = '';
        let inputIndex = 0;
        
        for (const char of pattern) {
          if (char === '_') {
            reconstructedWord += spellingInput[inputIndex] || '';
            inputIndex++;
          } else {
            reconstructedWord += char;
          }
        }
        
        const correct = reconstructedWord.toLowerCase().trim() === (currentRegularQuestion.correctAnswer as string).toLowerCase();
        setIsCorrect(correct);
        setShowFeedback(true);
        if (!correct) {
          void generateIncorrectHint({
            targetWord: String(currentRegularQuestion.correctAnswer || currentRegularQuestion.word || ''),
            studentAnswer: reconstructedWord,
            theme: 'adventure'
          });
        } else {
          setIncorrectHint('');
        }
      } else if (selectedOption !== null) {
        // For regular multiple choice questions, check the selected option
        const correct = selectedOption === currentRegularQuestion.correctAnswer;
        setIsCorrect(correct);
        setShowFeedback(true);
        // Ensure feedback is visible
        try { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); } catch {}
        if (!correct) {
          void generateIncorrectHint({
            targetWord: String(currentRegularQuestion.correctAnswer || currentRegularQuestion.word || ''),
            studentAnswer: String(selectedOption),
            theme: 'adventure'
          });
        } else {
          setIncorrectHint('');
        }
      }
    }
  };

  // Audible confirmation on feedback for regular MCQ
  useEffect(() => {
    if (!showFeedback || (!currentRegularQuestion && !currentLongAQuestion)) return;
    if ((currentRegularQuestion && currentRegularQuestion.isSpelling) || (currentLongAQuestion && currentLongAQuestion.isSpelling)) return;
    // For AI hook steps, we already autoplay the continuation prompt; avoid duplicate audio
    if (isAiHookStep) return;
    const speak = async () => {
      audioManager.stopAll();
      if (isCorrect) {
        await playElevenTTS('Great!');
      } else {
        await playElevenTTS('Not quite. Try again.');
      }
    };
    void speak();
  }, [showFeedback, isCorrect, currentRegularQuestion, currentLongAQuestion, isAiHookStep]);

  const handleTryAgain = () => {
    setSelectedOption(null);
    setSpellingInput('');
    setShowFeedback(false);
    setIsCorrect(false);
    setIncorrectHint('');
    setIsIncorrectHintLoading(false);
    // Reset speech-related state
    setAudioBlob(null);
    setTranscript('');
    setRealtimeTranscript('');
    setIsProcessing(false);
    setSpeechSuccess(false);
    setShowSpeechContinuation(false);
    setSpeechContinuationInput('');
    setSpeechValidationMessage('');
    setHasAutoplayedSpeechPrompt(false);
  };

  // Reset step-level UI state on step change to prevent bleed-through (e.g., green container, old inputs)
  useEffect(() => {
    // Stop any audio from previous step
    try { audioManager.stopAll(); } catch {}
    try {
      if (summaryAudioRef.current) {
        summaryAudioRef.current.pause();
        summaryAudioRef.current.currentTime = 0;
      }
    } catch {}
    setIsSummarySpeaking(false);
    currentElevenLabelRef.current = null;
    setHasAutoplayedLongAPassage(false);
    setHasGeneratedLongAPassage(false);
    setLongAPassage('');
    setIsLongAPassageLoading(false);
    setShowFeedback(false);
    setIsCorrect(false);
    setSelectedOption(null);
    setSpellingInput('');
    setIncorrectHint('');
    setIsIncorrectHintLoading(false);
    setIsContinuationHidden(false);
    setHasAutoplayedContPrompt(false);
    setContinuationHeader('');
    setValidationMessage('');
    setContinuationInput('');
    // Do not clear validatedContinuation; it is used to bridge story context when appropriate
  }, [currentQuestionIndex]);

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalSteps - 1) {
      // Move to next question
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setSpellingInput('');
      setShowFeedback(false);
      setIsCorrect(false);
      // Reset speech-related state
      setAudioBlob(null);
      setTranscript('');
      setRealtimeTranscript('');
      setIsProcessing(false);
      setSpeechSuccess(false);
      setShowSpeechContinuation(false);
      setSpeechContinuationInput('');
      setSpeechValidationMessage('');
      setHasAutoplayedSpeechPrompt(false);
      // Reset continuation UI state (but keep validatedContinuation for story context)
      setIsContinuationHidden(false);
      setHasAutoplayedContPrompt(false);
      setContinuationHeader('');
      setValidationMessage('');
      setContinuationInput('');
    } else {
      // All questions completed
      onComplete?.();
    }
  };

  // Global navigation: Next
  const handleNext = () => {
    // Stop any ongoing recordings to avoid dangling media tracks
    if (isRecording) {
      stopRecording();
    }
    if (isBlendingRecording) {
      stopBlendingRecording();
    }
    // Clear transient blending states
    setCurrentPhonemeIndex(-1);
    setBlendingTranscript('');
    setBlendingRealtimeTranscript('');
    setBlendingAudioBlob(null);

    handleNextQuestion();
  };

  // Global navigation: Previous
  const handlePreviousQuestion = () => {
    if (currentQuestionIndex <= 0) return;
    if (isRecording) {
      stopRecording();
    }
    if (isBlendingRecording) {
      stopBlendingRecording();
    }
    setCurrentQuestionIndex(prev => Math.max(prev - 1, 0));
    setSelectedOption(null);
    setShowFeedback(false);
    setIsCorrect(false);
    // Reset speech-related state
    setAudioBlob(null);
    setTranscript('');
    setRealtimeTranscript('');
    setIsProcessing(false);
    // Reset blending-related state
    setCurrentPhonemeIndex(-1);
    setBlendingTranscript('');
    setBlendingRealtimeTranscript('');
    setBlendingAudioBlob(null);
  };

  const handleSoundClick = async () => {
    // Toggle off if currently speaking
    if (isSpeaking) {
      audioManager.stopAll();
      setIsSpeaking(false);
      return;
    }

    let textToSpeak = '';
    if (isBlendingQuestion && currentBlendingQuestion) {
      textToSpeak = currentBlendingQuestion.word;
    } else if (isSpeechQuestion && currentSpeechQuestion) {
      textToSpeak = hasDynamicPassage && dynamicSpeechPassage ? dynamicSpeechPassage : '';
    } else if (isLongAQuestion && currentLongAQuestion) {
      textToSpeak = currentLongAQuestion.word;
    } else if (!isSpeechQuestion && !isBlendingQuestion && !isLongAQuestion && currentRegularQuestion) {
      textToSpeak = currentRegularQuestion.word;
    }

    if (textToSpeak.trim()) {
      setIsSpeaking(true);
      // Use slower speed (75%) for CVC word pronunciation to help Kindergarten students hear clearly
      const isWordQuestion = (isLongAQuestion && currentLongAQuestion) || (!isSpeechQuestion && !isBlendingQuestion && !isLongAQuestion && currentRegularQuestion);
      const speed = isWordQuestion ? 0.75 : 1.0; // Slower for CVC words, normal for passages
      
      const audio = await playElevenTTS(textToSpeak, undefined, speed);
      if (audio) {
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        audio.onpause = () => setIsSpeaking(false);
        audio.onabort = () => setIsSpeaking(false);
      } else {
        setIsSpeaking(false);
      }
    }
  };

  return (
    <>
      {/* Fullscreen image flow overlay when active */}
      {isImageStepActive && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f5edff' }}>
          {/* Large image stage */}
          <div style={{ maxWidth: 900, margin: '32px auto 0', padding: '0 16px' }}>
            <div style={{
              border: '3px solid #8b5cf6',
              borderRadius: 20,
              background: 'linear-gradient(180deg,#0f172a 0%,#111827 100%)',
              height: '64vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.25)'
            }}>
              {!imageUrl && !imageLoading && !imageError && (
                <div style={{ color: '#9CA3AF' }}>Your image will appear here</div>
              )}
              {imageLoading && (
                <div style={{ display: 'grid', placeItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'conic-gradient(from 0deg, #8b5cf6 0%, #a78bfa 50%, #8b5cf6 100%)',
                    mask: 'radial-gradient(farthest-side, transparent 68%, #000 69%)',
                    WebkitMask: 'radial-gradient(farthest-side, transparent 68%, #000 69%)',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <div style={{ color: '#e5e7eb', fontWeight: 700 }}>Generating your epic scene…</div>
                </div>
              )}
              {imageError && (
                <div style={{ color: '#DC2626', background: '#FFF1F2', padding: 16, borderRadius: 12 }}>{imageError}</div>
              )}
              {imageUrl && !imageLoading && !imageError && (
                <img src={imageUrl} alt="Generated scene" style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', objectPosition: 'center', display: 'block' }} />
              )}
            </div>
          </div>

          {/* Prompt editor under image with speech controls */}
          <div style={{ maxWidth: 900, margin: '16px auto 0', padding: '0 16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.98)', borderRadius: 16, padding: 12, display: 'grid', gridTemplateColumns: '1fr 44px 140px', gap: 8, alignItems: 'center', boxShadow: '0 10px 28px rgba(0,0,0,0.12)' }}>
              <input
                value={imageDescription}
                onChange={(e) => setImageDescription(e.target.value)}
                placeholder="Describe what to draw…"
                style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: '10px 12px' }}
              />
              <button
                onClick={isImageRecording ? stopImagePromptRecording : startImagePromptRecording}
                title={isImageRecording ? 'Stop recording' : 'Speak'}
                aria-label={isImageRecording ? 'Stop recording' : 'Speak'}
                style={{ width: 44, height: 44, borderRadius: '50%', background: isImageRecording ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: '1px solid rgba(0,0,0,0.1)', color: 'white', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="white"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="white"/>
                </svg>
              </button>
              <button
                onClick={() => { setImageUrl(null); setImageError(null); void generateImageFromDescription(); }}
                disabled={!imageDescription.trim() || imageLoading}
                style={{ minWidth: 140, height: 44, borderRadius: 12, background: '#8b5cf6', color: 'white', border: 'none', cursor: (!imageDescription.trim() || imageLoading) ? 'not-allowed' : 'pointer', fontWeight: 700 }}
              >
                {imageLoading ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>

          {/* Bottom-right control: Continue only */}
          <div style={{ position: 'fixed', right: 24, bottom: 24 }}>
            <button
              onClick={continueAfterImage}
              style={{ minWidth: 140, height: 44, borderRadius: 12, background: '#10b981', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(16,185,129,0.35)' }}
            >
              Continue ➤
            </button>
          </div>
        </div>
      )}
      {/* CSS Animations and Speech Bubbles */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes sparkle {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.7; }
          50% { transform: scale(1.2) rotate(180deg); opacity: 1; }
        }
        
        /* Speech bubble tails - AI on bottom left, User on bottom right */
        .speech-bubble-ai::before {
          content: '';
          position: absolute;
          left: -6px;
          bottom: 12px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 12px 12px;
          border-color: transparent transparent rgba(255,255,255,0.98) transparent;
          transform: rotate(45deg);
        }
        
        .speech-bubble-ai::after {
          content: '';
          position: absolute;
          left: -5px;
          bottom: 13px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 10px 10px;
          border-color: transparent transparent rgba(255,255,255,0.9) transparent;
          transform: rotate(45deg);
          z-index: 1;
        }
        
        .speech-bubble-student::before {
          content: '';
          position: absolute;
          right: -6px;
          bottom: 12px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 12px 12px 0 0;
          border-color: #FFFADB transparent transparent transparent;
          transform: rotate(45deg);
        }
        
        .speech-bubble-student::after {
          content: '';
          position: absolute;
          right: -5px;
          bottom: 13px;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 10px 10px 0 0;
          border-color: rgba(255,245,205,0.9) transparent transparent transparent;
          transform: rotate(45deg);
          z-index: 1;
        }

        /* Subtle fade/slide animations for green box exit */
        .fade-out { opacity: 0.7; transition: opacity 400ms ease; }
        .slide-out { transform: translateX(20px); opacity: 0.0; transition: transform 450ms ease, opacity 450ms ease; }

        /* Pop-in animation for the new user story card */
        @keyframes pop-in {
          0% { transform: translateY(8px) scale(0.98); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
      
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f3e9ff 0%, #efe3ff 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative'
      }}>
      {/* Step 5: move the AI hook into the central prompt; hide top-left bubble */}
      {/* Progress indicator */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '16px',
        padding: '9.6px 16px',
        fontSize: '12.8px',
        fontWeight: '600',
        color: '#374151',
        boxShadow: '0 3.2px 9.6px rgba(0,0,0,0.1)'
      }}>
        Step {currentQuestionIndex + 1} of {totalSteps}
      </div>
      {/* Content area - different layouts for blending, speech vs regular questions */}
      {isBlendingQuestion && currentBlendingQuestion ? (
        <>
          {/* Blending Question Layout */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '19.2px',
            width: 'min(896px, 92vw)',
            margin: '0 auto'
          }}>
            {/* Top controls - center aligned: Hear, Blend, Toggle */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '12.8px',
              width: '100%',
              marginBottom: '6.4px',
              padding: '0 6.4px'
            }}>
              {/* Hear and Blend buttons */}
              <div style={{
                display: 'flex',
                gap: '12.8px'
              }}>
                <button
                  onClick={handleHearWord}
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '11.2px',
                    padding: '9.6px 19.2px',
                    fontSize: '12.8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4.8px',
                    boxShadow: '0 4.8px 16px rgba(139, 92, 246, 0.25)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.95)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  🔊 Hear
                </button>
                
                <button
                  onClick={handleBlendSounds}
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '11.2px',
                    padding: '9.6px 19.2px',
                    fontSize: '12.8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4.8px',
                    boxShadow: '0 4.8px 16px rgba(139, 92, 246, 0.25)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.95)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  Blend
                </button>
              </div>

              {/* Blending Sound toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <button
                  onClick={() => setBlendingSoundOn(!blendingSoundOn)}
                  style={{
                    width: '41.6px',
                    height: '20.8px',
                    borderRadius: '10.4px',
                    border: 'none',
                    background: blendingSoundOn ? '#8b5cf6' : '#d1d5db',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{
                    width: '17.6px',
                    height: '17.6px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '1.6px',
                    left: blendingSoundOn ? '22.4px' : '1.6px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </button>
                <span style={{
                  fontSize: '11.2px',
                  fontWeight: '600',
                  color: '#6b7280'
                }}>
                  Blending Sound {blendingSoundOn ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>

            {/* Word display */}
            <div style={{
              background: '#fdfbff',
              borderRadius: '32px',
              padding: '64px 76.8px',
              boxShadow: '9.6px 14.4px 0 rgba(156, 126, 172, 0.25), 0 22.4px 64px rgba(0,0,0,0.08)',
              textAlign: 'center',
              width: 'min(640px, 92vw)',
              margin: '0 auto',
              minHeight: '288px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              {/* Individual letters with highlighting */}
              <div style={{
                display: 'flex',
                gap: '9.6px',
                marginBottom: '24px',
                alignItems: 'center'
              }}>
                {currentBlendingQuestion.phonemes.map((phoneme, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '9.6px'
                  }}>
                    {/* Phoneme (letter or digraph) */}
                    <div style={{
                      fontSize: '120px',
                      fontWeight: '800',
                      color: currentPhonemeIndex === index ? '#8b5cf6' : '#111827',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      transition: 'color 0.3s ease',
                      textShadow: currentPhonemeIndex === index ? '0 0 12.8px rgba(139, 92, 246, 0.45)' : 'none'
                    }}>
                      {phoneme}
                    </div>
                    {/* Dot positioned under each letter */}
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: currentPhonemeIndex === index ? '#8b5cf6' : '#c084fc',
                      transition: 'all 0.3s ease',
                      transform: currentPhonemeIndex === index ? 'scale(1.25)' : 'scale(1)'
                    }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Speech Recognition Section - simplified */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '19.2px',
              padding: '25.6px',
              boxShadow: '0 6.4px 25.6px rgba(0,0,0,0.08)',
              border: '1px solid rgba(139, 92, 246, 0.1)',
              width: 'min(640px, 92vw)',
              margin: '19.2px auto 0',
              textAlign: 'center'
            }}>
              {/* Header */}
              <h3 style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#374151',
                margin: '0 0 19.2px 0'
              }}>
                Now say the word 3 times
              </h3>

              {/* Microphone */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12.8px',
                marginBottom: '19.2px'
              }}>
                <button
                  onClick={isBlendingRecording ? stopBlendingRecording : startBlendingRecording}
                  disabled={isBlendingProcessing}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: isBlendingProcessing
                      ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
                      : isBlendingRecording 
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    cursor: isBlendingProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isBlendingRecording 
                      ? '0 6.4px 19.2px rgba(239, 68, 68, 0.3)' 
                      : '0 6.4px 19.2px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseDown={(e) => {
                    if (!isBlendingProcessing) e.currentTarget.style.transform = 'scale(0.95)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {isBlendingProcessing ? (
                    // Processing spinner
                    <div style={{
                      width: '19.2px',
                      height: '19.2px',
                      border: '3px solid rgba(255,255,255,0.3)',
                      borderTop: '3px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  ) : isBlendingRecording ? (
                    // Stop icon
                    <div style={{
                      width: '16px',
                      height: '16px',
                      background: 'white',
                      borderRadius: '3px'
                    }} />
                  ) : (
                    // Microphone icon
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
                        fill="white"
                      />
                      <path
                        d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
                        fill="white"
                      />
                    </svg>
                  )}
                  
                  {/* Recording animation */}
                  {isBlendingRecording && (
                    <div style={{
                      position: 'absolute',
                      inset: '-6.4px',
                      border: '3px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '50%',
                      animation: 'pulse 1.5s infinite'
                    }} />
                  )}
                </button>

                {/* Status text */}
                {(isBlendingProcessing || isBlendingRecording) && (
                  <div style={{
                    fontSize: '11.2px',
                    fontWeight: '600',
                    color: isBlendingRecording ? '#ef4444' : '#6b7280'
                  }}>
                    {isBlendingProcessing 
                      ? 'Processing...' 
                      : '🔴 Recording... Click to stop'}
                  </div>
                )}
              </div>

              {/* Final result only - no live transcript */}
              {blendingTranscript && !isBlendingRecording && (
                <div style={{
                  padding: '16px 19.2px',
                  background: blendingTranscript.toLowerCase().includes(currentBlendingQuestion?.word.toLowerCase() || '')
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  borderRadius: '12.8px',
                  fontSize: '12.8px',
                  fontWeight: '600',
                  boxShadow: '0 6.4px 20px rgba(0,0,0,0.15)',
                  lineHeight: '1.5',
                  marginBottom: '19.2px'
                }}>
                  {/* Removed "Final Result" label for blending, to reduce clutter */}
                  <div style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '9.6px 12.8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: '12.8px',
                    fontWeight: '500'
                  }}>
                    "{blendingTranscript}"
                  </div>
                </div>
              )}

              {/* Action buttons - only show when we have a result */}
              {!isBlendingRecording && (blendingTranscript || blendingAudioBlob) && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '12.8px'
                }}>
                  <button
                    onClick={resetBlendingSession}
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '14px',
                      padding: '12px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'scale(0.95)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    🔁 Try Again
                  </button>
                  <button
                    onClick={handleNextQuestion}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '14px',
                      padding: '12px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'scale(0.95)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    ✨ Continue
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : isSpeechQuestion && currentSpeechQuestion ? (
        <>
          {/* Speech Question Layout - Wrapper Container */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '32px',
            width: '100%',
            maxWidth: '960px',
            margin: '0 auto'
          }}>
            {/* Top section with audio button and main content */}
            <div style={{
              position: 'relative',
              width: '100%',
              maxWidth: '640px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Audio button positioned to the left, not affecting layout width */}
              <button
                onClick={handleSoundClick}
                style={{
                  position: 'absolute',
                  left: '-112px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '80px',
                  height: '80px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6.4px 19.2px rgba(139, 92, 246, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(0.95)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
              >
                {/* Sound icon */}
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
                    fill="white"
                  />
                </svg>
              </button>

              {/* Main content container - similar to question 1's sack container */}
              <div id="speech-main-container" style={{
                background: '#fdfbff',
                borderRadius: '32px',
                padding: '40px 48px',
                boxShadow: '9.6px 14.4px 0 rgba(156, 126, 172, 0.25), 0 22.4px 64px rgba(0,0,0,0.08)',
                textAlign: 'center',
                maxWidth: '640px',
                minHeight: '256px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '24px'
              }}>
                {/* Story text - directly in white container */}
                <div style={{
                  fontSize: '17.6px',
                  lineHeight: '1.7',
                  color: '#1f2937',
                  fontWeight: '600',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  textAlign: 'center'
                }}>
                  {isDynamicPassageLoading ? 'Generating your story passage…' : (hasDynamicPassage && dynamicSpeechPassage ? dynamicSpeechPassage : '')}
                </div>

                {/* Story emojis - integrated below the text */}
                <div style={{
                  fontSize: '64px',
                  letterSpacing: '6.4px',
                  textShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))'
                }}>
                  {currentSpeechQuestion.imageUrl}
                </div>
              </div>
            </div>

            {/* Recording section - aligned to main container */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '19.2px',
              padding: '25.6px',
              boxShadow: '0 6.4px 25.6px rgba(0,0,0,0.08)',
              border: '1px solid rgba(139, 92, 246, 0.1)',
              width: '100%',
              maxWidth: '640px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              {/* Header */}
              <h3 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#374151',
                margin: '0 0 24px 0'
              }}>
                Now read the story back to me
              </h3>

              {/* Microphone */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                marginBottom: '24px',
                width: '100%'
              }}>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: isProcessing
                      ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
                      : isRecording 
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isRecording 
                      ? '0 8px 24px rgba(239, 68, 68, 0.3)' 
                      : '0 8px 24px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseDown={(e) => {
                    if (!isProcessing) e.currentTarget.style.transform = 'scale(0.95)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {isProcessing ? (
                    // Processing spinner
                    <div style={{
                      width: '24px',
                      height: '24px',
                      border: '3px solid rgba(255,255,255,0.3)',
                      borderTop: '3px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  ) : isRecording ? (
                    // Stop icon
                    <div style={{
                      width: '20px',
                      height: '20px',
                      background: 'white',
                      borderRadius: '3px'
                    }} />
                  ) : (
                    // Microphone icon
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
                        fill="white"
                      />
                      <path
                        d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
                        fill="white"
                      />
                    </svg>
                  )}
                  
                  {/* Recording animation */}
                  {isRecording && (
                    <div style={{
                      position: 'absolute',
                      inset: '-8px',
                      border: '3px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '50%',
                      animation: 'pulse 1.5s infinite'
                    }} />
                  )}
                </button>

                {/* Status text */}
                {(isProcessing || isRecording) && (
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: isRecording ? '#ef4444' : '#6b7280'
                  }}>
                    {isProcessing 
                      ? 'Processing...' 
                      : '🔴 Recording... Click to stop'}
                  </div>
                )}
              </div>

              {/* Live transcript display */}
              {realtimeTranscript && isRecording && (
                <div style={{
                  padding: '20px 24px',
                  background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                  color: '#065f46',
                  borderRadius: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
                  lineHeight: '1.5',
                  marginBottom: '24px',
                  border: '2px solid #10b981',
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '500px'
                }}>
                  <div style={{
                    fontWeight: '700',
                    marginBottom: '12px',
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    opacity: 0.9,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ color: '#ef4444' }}>🔴</span>
                    Live Transcript
                  </div>
                  <div style={{
                    background: 'rgba(255,255,255,0.7)',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    fontSize: '16px',
                    fontWeight: '500',
                    color: '#1f2937'
                  }}>
                    "{realtimeTranscript}"
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#047857',
                    marginTop: '8px',
                    fontStyle: 'italic'
                  }}>
                    Keep speaking... I'm listening! 👂
                  </div>
                </div>
              )}

              {/* Final result - show when we have processed audio (even if transcript is short) */}
              {(hasSpeechEvaluated && !isRecording) && (
                <div style={{
                  padding: '20px 24px',
                  background: hasSpeechEvaluated && speechSuccess
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  borderRadius: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                  lineHeight: '1.5',
                  marginBottom: '24px',
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '500px'
                }}>
                  {/* AI coaching line on top of container */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>
                      {isSpeechHintLoading
                        ? 'Thinking…'
                        : (speechHint && hasSpeechEvaluated && !speechSuccess ? speechHint : '')}
                    </span>
                    {speechHint && !isSpeechHintLoading && hasSpeechEvaluated && !speechSuccess && (
                      <button
                        onClick={async () => {
                          const label = String(speechHint || '').trim();
                          if (!label) return;
                          if (currentElevenLabelRef.current === label) {
                            audioManager.stopAll();
                            currentElevenLabelRef.current = null;
                            return;
                          }
                          currentElevenLabelRef.current = label;
                          await playElevenTTS(label);
                        }}
                        title={(() => { const line = speechHint; return currentElevenLabelRef.current === String(line || '').trim() ? 'Stop' : 'Hear'; })()}
                        style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.25)', cursor: 'pointer' }}
                      >🔊</button>
                    )}
                  </div>
                  {/* Removed "Final Result" label to reduce clutter */}
                  <div style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: '18px',
                    fontWeight: '500',
                    marginBottom: '8px'
                  }}>
                    "{transcript || '…'}"
                  </div>
                  {/* Bottom AI text removed to avoid duplication; hint is shown only at the top */}
                </div>
              )}

              {/* Continuation section for successful speech reading */}
              {speechSuccess && showSpeechContinuation && (
                <div style={{
                  padding: '16px 20px',
                  background: '#10b981',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
                  lineHeight: '1.5',
                  marginBottom: '24px',
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '500px'
                }}>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    marginBottom: '12px'
                  }}>
                    🎉 Awesome reading! What do you think happens next?
                  </div>
                  
                  {/* Speech continuation input */}
                  <div style={{
                    marginTop: '12px',
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: '1fr 44px 44px 44px',
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    <textarea
                      value={speechContinuationInput}
                      onChange={(e) => setSpeechContinuationInput(e.target.value)}
                      placeholder="What happens next in London's adventure?"
                      rows={2}
                      style={{
                        width: '100%',
                        borderRadius: 12,
                        border: '2px solid rgba(255,255,255,0.6)',
                        padding: '10px 16px',
                        resize: 'none',
                        minHeight: '40px',
                        maxHeight: '64px',
                        outline: 'none',
                        fontSize: '14px'
                      }}
                    />
                    {/* Mic button for speech continuation */}
                    <button
                      onClick={isSpeechContRecording ? stopSpeechContRecording : startSpeechContRecording}
                      title={isSpeechContRecording ? 'Stop recording' : 'Speak'}
                      aria-label={isSpeechContRecording ? 'Stop recording' : 'Speak'}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: isSpeechContRecording ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: '1px solid rgba(255,255,255,0.6)',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="white"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="white"/>
                      </svg>
                    </button>
                    {/* Icon CTA: Create Image (speech) - DISABLED BY FEATURE FLAG */}
                    {ENABLE_CONTINUATION_IMAGE_GENERATION && (
                      <button
                        onClick={startImageFromSpeechContinuation}
                        title="Create image from this response"
                        aria-label="Create image from this response"
                        disabled={!speechContinuationInput.trim()}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: speechContinuationInput.trim() ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#9ca3af',
                          border: '1px solid rgba(255,255,255,0.6)',
                          color: 'white',
                          cursor: speechContinuationInput.trim() ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                        }}
                      >
                        <span role="img" aria-label="Create Image">🌄</span>
                      </button>
                    )}
                    {/* Icon CTA: Continue story (speech) */}
                    <button
                      onClick={handleSubmitSpeechContinuation}
                      title="Submit and continue the story"
                      aria-label="Submit and continue the story"
                      disabled={!speechContinuationInput.trim()}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: speechContinuationInput.trim() ? 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)' : '#9ca3af',
                        color: '#111827',
                        border: '1px solid rgba(255,255,255,0.6)',
                        cursor: speechContinuationInput.trim() ? 'pointer' : 'not-allowed',
                        fontWeight: 800,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                      }}
                    >
                      ➤
                    </button>
                  </div>
                  
                  {speechValidationMessage && (
                    <div style={{
                      marginTop: '8px',
                      fontSize: '14px',
                      fontStyle: 'italic'
                    }}>
                      {speechValidationMessage}
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons removed per request */}
            </div>
          </div>
        </>
      ) : isLongAQuestion && currentLongAQuestion ? (
        <>
          {/* Question prompt for long A questions - moved above image */}
          <div style={{
            marginBottom: '28.8px',
            padding: '12px 16px',
            background: 'rgba(255, 255, 255, 0.98)',
            borderRadius: '20px',
            boxShadow: '0 12px 0 rgba(156,126,172,0.25), 0 12px 24px rgba(0,0,0,0.15)',
            maxWidth: '720px',
            margin: '0 auto 28.8px',
            position: 'relative'
          }}>
            {isAiHookStep ? (
              <>
                <div style={{
                  color: '#111827',
                  lineHeight: 1.5,
                  fontWeight: 400,
                  fontSize: 17.5,
                  textAlign: 'center',
                  fontFamily: 'Quicksand, sans-serif'
                }}>
                  {isLongAPassageLoading ? 'Creating…' : longAPassage}
                </div>
                {/* Audio button anchored bottom-right without affecting height */}
                <button
                  onClick={handleSummaryAudio}
                  title={isSummarySpeaking ? 'Stop' : 'Hear'}
                  style={{
                    position: 'absolute',
                    right: 12,
                    bottom: 8,
                    width: 30,
                    height: 30,
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 6px 18px rgba(139, 92, 246, 0.30)'
                  }}
                >
                  🔊
                </button>
              </>
            ) : (
              <>
                <div style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#1f2937',
                  marginBottom: '4.8px'
                }}>
                  🎧 Listen to London's word!
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                  Type the word you hear.
                </div>
              </>
            )}
          </div>

          {/* Long A Question Layout */}
          <div style={{
            marginBottom: '32px',
            position: 'relative',
            borderRadius: '16px',
            overflow: 'visible',
            boxShadow: '0 6.4px 25.6px rgba(0,0,0,0.15)'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '720px',
              position: 'relative',
              margin: '0 auto'
            }}>
              {/* Speaker button to the left of image */}
              <button
                onClick={handleSoundClick}
                style={{
                  position: 'absolute',
                  left: '-96px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6.4px 19.2px rgba(139, 92, 246, 0.35)',
                  transition: 'all 0.2s ease'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(0.95)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="white"/>
                </svg>
              </button>

              {/* Regenerate button to the right of image */}
              <button
                onClick={() => void regenerateQuestionImage()}
                title={questionImageRegenerating ? 'Regenerating…' : 'Regenerate image'}
                aria-label="Regenerate image"
                disabled={questionImageRegenerating}
                style={{
                  position: 'absolute',
                  right: '-96px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  background: questionImageRegenerating
                    ? 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)'
                    : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  border: 'none',
                  cursor: questionImageRegenerating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6.4px 19.2px rgba(139, 92, 246, 0.35)',
                  transition: 'all 0.2s ease'
                }}
                onMouseDown={(e) => {
                  if (!questionImageRegenerating) e.currentTarget.style.transform = 'translateY(-50%) scale(0.95)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
              >
                <span style={{ fontSize: 26, color: 'white' }}>{questionImageRegenerating ? '↻' : '↺'}</span>
              </button>

              {/* Image container */}
              <div style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
                border: '3.2px solid #8b5cf6',
                borderRadius: '16px',
                fontSize: '112px',
                letterSpacing: '3.2px',
                boxShadow: '0 6.4px 25.6px rgba(139, 92, 246, 0.3), inset 0 1.6px 3.2px rgba(255,255,255,0.1)',
                position: 'relative',
                overflow: 'hidden',
                padding: '8px',
                maxHeight: '420px',
                minHeight: '220px'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle at 30% 20%, rgba(139, 92, 246, 0.25) 0%, transparent 50%)',
                  animation: 'pulse 3s ease-in-out infinite'
                }} />
                <div style={{ position: 'relative', zIndex: 1, textShadow: '0 2px 8px rgba(0,0,0,0.5)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {questionImageLoading ? (
                    <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid #ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  ) : questionImageUrl ? (
                    <img src={questionImageUrl} alt="Generated scene" style={{ maxWidth: '100%', maxHeight: '404px', width: 'auto', height: 'auto', objectFit: 'contain', objectPosition: 'center', display: 'block', borderRadius: 12 }} />
                  ) : (
                    currentLongAQuestion.imageUrl
                  )}
                </div>
                {questionImageRegenerating && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'white', fontWeight: 700 }}>
                      <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.4)', borderTop: '3px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <div style={{ fontSize: 13 }}>Regenerating…</div>
                    </div>
                  </div>
                )}
                {/* Inner regenerate button removed in favor of right-side button */}
              </div>
            </div>
          </div>

          {/* Answer interface for Long A questions */}
          {currentLongAQuestion.isSorting ? (
            /* Sorting interface */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              marginTop: '12px'
            }}>
              <div style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#374151',
                textAlign: 'center'
              }}>
                Sort the words by their vowel patterns:
              </div>
              
              {/* Draggable words */}
              <div 
                style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  minHeight: '60px',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '2px dashed #cbd5e1',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  transition: 'all 0.2s ease'
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.background = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
                  e.currentTarget.style.borderColor = '#f59e0b';
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  // No need to do anything - word is already removed from bin when dragging starts
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              >
                {currentLongAQuestion.sortingWords?.filter(word => 
                  !Object.values(sortingAnswers).flat().includes(word)
                ).length === 0 ? (
                  <div style={{
                    color: '#9ca3af',
                    fontSize: '16px',
                    fontWeight: '500',
                    fontStyle: 'italic',
                    textAlign: 'center',
                    width: '100%',
                    padding: '8px'
                  }}>
                    Drag words here to remove them from bins
                  </div>
                ) : null}
                {currentLongAQuestion.sortingWords?.filter(word => 
                  !Object.values(sortingAnswers).flat().includes(word)
                ).map((word, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={(e) => {
                      setDraggingWord(word);
                      e.dataTransfer.setData('text/plain', word);
                    }}
                    onDragEnd={() => setDraggingWord(null)}
                    style={{
                      padding: '12px 20px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '18px',
                      fontWeight: '600',
                      cursor: 'grab',
                      userSelect: 'none',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.cursor = 'grabbing';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.cursor = 'grab';
                    }}
                  >
                    {word}
                  </div>
                ))}
              </div>

              {/* Sorting bins */}
              <div style={{
                display: 'flex',
                gap: '24px',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                {currentLongAQuestion.sortingBins?.map((binLabel, binIndex) => (
                  <div
                    key={binIndex}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.background = 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)';
                      e.currentTarget.style.borderColor = '#22c55e';
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const word = e.dataTransfer.getData('text/plain');
                      if (word) {
                        setSortingAnswers(prev => ({
                          ...prev,
                          [binLabel]: [...(prev[binLabel] || []), word]
                        }));
                      }
                      e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                    style={{
                      minWidth: '180px',
                      minHeight: '120px',
                      padding: '16px',
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      border: '3px dashed #cbd5e1',
                      borderRadius: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#475569',
                      marginBottom: '8px'
                    }}>
                      {binLabel}
                    </div>
                    {(sortingAnswers[binLabel] || []).map((word, wordIndex) => (
                      <div
                        key={wordIndex}
                        draggable
                        onDragStart={(e) => {
                          setDraggingWord(word);
                          e.dataTransfer.setData('text/plain', word);
                          // Remove from current bin immediately when dragging starts
                          setSortingAnswers(prev => ({
                            ...prev,
                            [binLabel]: prev[binLabel]?.filter(w => w !== word) || []
                          }));
                        }}
                        onDragEnd={() => setDraggingWord(null)}
                        style={{
                          padding: '8px 12px',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: 'white',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'grab',
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                          transition: 'all 0.2s ease',
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.cursor = 'grabbing';
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.cursor = 'grab';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.cursor = 'grab';
                        }}
                      >
                        {word}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : currentLongAQuestion.isFillBlank ? (
            /* Fill-in-the-blank interface for long A questions */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              marginTop: '12px'
            }}>
              <div style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#374151',
                textAlign: 'center'
              }}>
                🎯 Fill in the missing letters:
              </div>
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}>
                {(currentLongAQuestion.fillBlankPattern || '').split('').map((char, index) => {
                  const isBlank = char === '_';
                  const blankIndex = (currentLongAQuestion.fillBlankPattern || '').slice(0, index).split('_').length - 1;
                  
                  return isBlank ? (
                    <input
                      key={index}
                      type="text"
                      aria-label={`Missing letter ${blankIndex + 1}`}
                      maxLength={1}
                      value={spellingInput[blankIndex] || ''}
                      onChange={(e) => {
                        const newInput = spellingInput.split('');
                        newInput[blankIndex] = e.target.value.toLowerCase();
                        setSpellingInput(newInput.join(''));
                        // Auto-focus next blank input
                        const allInputs = Array.from(e.currentTarget.parentElement?.children || [])
                          .filter(el => el.tagName === 'INPUT') as HTMLInputElement[];
                        const currentInputIndex = allInputs.indexOf(e.currentTarget);
                        if (e.target.value && currentInputIndex < allInputs.length - 1) {
                          allInputs[currentInputIndex + 1]?.focus();
                        }
                      }}
                      style={{
                        width: '48px',
                        height: '56px',
                        fontSize: '22px',
                        fontWeight: '700',
                        textAlign: 'center',
                        border: '3px solid #e0e0e0',
                        borderRadius: '10px',
                        background: 'white',
                        color: '#374151',
                        outline: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.border = '3px solid #8b5cf6';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.border = '3px solid #e0e0e0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  ) : (
                    <div
                      key={index}
                      style={{
                        width: '48px',
                        height: '56px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '22px',
                        fontWeight: '700',
                        borderRadius: '10px',
                        background: '#f1f5f9',
                        border: '3px solid #e2e8f0',
                        color: '#64748b'
                      }}
                    >
                      {char}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Spelling input interface for non-sorting long A questions */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            marginTop: '12px'
          }}>
            <div style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#374151',
              textAlign: 'center'
            }}>
              🎯 Type the word you hear:
            </div>
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              {Array.from({ length: (currentLongAQuestion.correctAnswer as string).length }).map((_, index) => (
                <input
                  key={index}
                  type="text"
                  aria-label={`Letter ${index + 1}`}
                  maxLength={1}
                  value={spellingInput[index] || ''}
                  onChange={(e) => {
                    const newInput = spellingInput.split('');
                    newInput[index] = e.target.value.toLowerCase();
                    setSpellingInput(newInput.join(''));
                    // Auto-focus next input
                    if (e.target.value && index < (currentLongAQuestion.correctAnswer as string).length - 1) {
                      const nextInput = e.currentTarget.parentElement?.children[index + 1] as HTMLInputElement;
                      nextInput?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
                      const prevInput = e.currentTarget.parentElement?.children[index - 1] as HTMLInputElement;
                      prevInput?.focus();
                    }
                  }}
                  style={{
                    width: '48px',
                    height: '56px',
                    fontSize: '22px',
                    fontWeight: '700',
                    textAlign: 'center',
                    border: '3px solid #e0e0e0',
                    borderRadius: '10px',
                    background: 'white',
                    color: '#374151',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.border = '3px solid #8b5cf6';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.border = '3px solid #e0e0e0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              ))}
            </div>
          </div>
          )}
        </>
      ) : isAdventureMode1 ? (
        <AdventureMode2 
          selectedStoryId={selectedStoryId}
          onAdventureMessage={(userMessage: string) => setStoryContext(prev => [...prev, userMessage])} 
          onStoryUpdate={(storyUpdate: string) => setStoryContext(prev => [...prev, storyUpdate])}
          onSwitchToQuestions={() => {
            // Move to the next question step (exit adventure mode)
            setCurrentQuestionIndex(prev => prev + 1);
          }}
          onGoToPrevious={() => {
            // Go to previous step (same as the always-visible Previous button)
            handlePreviousQuestion();
          }}
          onNavigateToPetStore={onNavigateToPetStore}
        />
      ) : isAdventureMode2 ? (
        <AdventureMode 
          onAdventureMessage={(userMessage: string) => setStoryContext(prev => [...prev, userMessage])} 
          onStoryUpdate={(storyUpdate: string) => setStoryContext(prev => [...prev, storyUpdate])}
          onSwitchToQuestions={() => {
            // Move to the next question step (exit adventure mode)
            setCurrentQuestionIndex(prev => prev + 1);
          }}
          onGoToPrevious={() => {
            // Go to previous step (same as the always-visible Previous button)
            handlePreviousQuestion();
          }}
        />
      ) : (isAdventureMode5 || isAdventureMode10) ? (
        <AdventureMode 
          onAdventureMessage={(userMessage: string) => setStoryContext(prev => [...prev, userMessage])} 
          onStoryUpdate={(storyUpdate: string) => setStoryContext(prev => [...prev, storyUpdate])}
          onSwitchToQuestions={() => {
            // Move to the next question step (exit adventure mode)
            setCurrentQuestionIndex(prev => prev + 1);
          }}
          onGoToPrevious={() => {
            // Go to previous step (same as the always-visible Previous button)
            handlePreviousQuestion();
          }}
        />
      ) : (
        <>
          {/* Regular Question Prompt - moved above image; for step 5, show AI hook here */}
          {!isBlendingQuestion && !isSpeechQuestion && !isLongAQuestion && (
            <div style={{
              marginBottom: '28.8px',
              padding: '16px 20px',
              background: 'rgba(255, 255, 255, 0.98)',
              borderRadius: '20px',
              boxShadow: '0 12px 0 rgba(156,126,172,0.25), 0 12px 24px rgba(0,0,0,0.15)',
              maxWidth: '720px',
              margin: '0 auto 28.8px',
              position: 'relative'
            }}>
              {isAiHookStep ? (
                <>
                  <div style={{
                    color: '#111827',
                    lineHeight: 1.5,
                    fontWeight: 400,
                    fontSize: 20,
                    textAlign: 'center',
                    fontFamily: 'Quicksand, sans-serif'
                  }}>
                    {isSummaryLoading ? 'Creating…' : aiSummary}
                  </div>
                  {/* Audio button anchored bottom-right without affecting height */}
                  <button
                    onClick={handleSummaryAudio}
                    title={isSummarySpeaking ? 'Stop' : 'Hear'}
                    style={{
                      position: 'absolute',
                      right: 12,
                      bottom: 8,
                      width: 30,
                      height: 30,
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                      color: 'white',
                      cursor: 'pointer',
                      boxShadow: '0 6px 18px rgba(139, 92, 246, 0.30)'
                    }}
                  >
                    🔊
                  </button>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: '19.2px',
                    fontWeight: '700',
                    color: '#1f2937',
                    marginBottom: '4.8px'
                  }}>
                    🎧 Listen to London's word!
                  </div>
                  <div style={{ fontSize: '14.4px', color: '#6b7280', fontWeight: '500' }}>
                    What sound does it start with?
                  </div>
                </>
              )}
            </div>
          )}

          {/* Regular Question Layout */}
          <div style={{
            marginBottom: '32px',
            position: 'relative',
            borderRadius: '16px',
            overflow: 'visible',
            boxShadow: '0 6.4px 25.6px rgba(0,0,0,0.15)'
          }}>
            {currentRegularQuestion && (
              <div style={{
                width: '100%',
                maxWidth: '720px',
                position: 'relative',
                margin: '0 auto'
              }}>
                {/* Speaker button to the left of image */}
                <button
                  onClick={handleSoundClick}
                  style={{
                    position: 'absolute',
                    left: '-96px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6.4px 19.2px rgba(139, 92, 246, 0.35)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'translateY(-50%) scale(0.95)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                  }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="white"/>
                  </svg>
                </button>

                {/* Regenerate button to the right of image (regular questions) */}
                <button
                  onClick={() => void regenerateQuestionImage()}
                  title={questionImageRegenerating ? 'Regenerating…' : 'Regenerate image'}
                  aria-label="Regenerate image"
                  disabled={questionImageRegenerating}
                  style={{
                    position: 'absolute',
                    right: '-96px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: questionImageRegenerating
                      ? 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)'
                      : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    border: 'none',
                    cursor: questionImageRegenerating ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6.4px 19.2px rgba(139, 92, 246, 0.35)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseDown={(e) => {
                    if (!questionImageRegenerating) e.currentTarget.style.transform = 'translateY(-50%) scale(0.95)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                  }}
                >
                  <span style={{ fontSize: 26, color: 'white' }}>{questionImageRegenerating ? '↻' : '↺'}</span>
                </button>

                {/* Image container */}
                <div style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
                  border: '3.2px solid #8b5cf6',
                  borderRadius: '16px',
                  fontSize: '112px',
                  letterSpacing: '3.2px',
                  boxShadow: '0 6.4px 25.6px rgba(139, 92, 246, 0.3), inset 0 1.6px 3.2px rgba(255,255,255,0.1)',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '8px',
                  maxHeight: '420px',
                  minHeight: '220px'
                }}>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at 30% 20%, rgba(139, 92, 246, 0.25) 0%, transparent 50%)',
                    animation: 'pulse 3s ease-in-out infinite'
                  }} />
                  <div style={{ position: 'relative', zIndex: 1, textShadow: '0 2px 8px rgba(0,0,0,0.5)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {questionImageLoading ? (
                      <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid #ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    ) : questionImageUrl ? (
                      <img src={questionImageUrl} alt="Generated scene" style={{ maxWidth: '100%', maxHeight: '404px', width: 'auto', height: 'auto', objectFit: 'contain', objectPosition: 'center', display: 'block', borderRadius: 12 }} />
                    ) : (
                      currentRegularQuestion.imageUrl
                    )}
                  </div>
                  {questionImageRegenerating && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'white', fontWeight: 700 }}>
                        <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.4)', borderTop: '3px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <div style={{ fontSize: 13 }}>Regenerating…</div>
                      </div>
                    </div>
                  )}
                  {/* Corner button removed in favor of right-side external button */}
                </div>
              </div>
            )}
          </div>

          {/* Answer interface for regular questions */}
          {!isBlendingQuestion && !isSpeechQuestion && !isLongAQuestion && currentRegularQuestion && (
            <div style={{ marginTop: '12px' }}>
              {currentRegularQuestion.isSpelling ? (
                /* Spelling input interface (dynamic length) */
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '20px'
                }}>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#374151',
                    textAlign: 'center'
                  }}>
                    🎯 Type the word you hear:
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    justifyContent: 'center'
                  }}>
                    {Array.from({ length: (currentRegularQuestion.correctAnswer as string).length }).map((_, index) => (
                      <input
                        key={index}
                        type="text"
                        aria-label={`Letter ${index + 1}`}
                        maxLength={1}
                        value={spellingInput[index] || ''}
                        onChange={(e) => {
                          const newInput = spellingInput.split('');
                          newInput[index] = e.target.value.toLowerCase();
                          setSpellingInput(newInput.join(''));
                          // Auto-focus next input
                          if (e.target.value && index < (currentRegularQuestion.correctAnswer as string).length - 1) {
                            const nextInput = e.currentTarget.parentElement?.children[index + 1] as HTMLInputElement;
                            nextInput?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
                            const prevInput = e.currentTarget.parentElement?.children[index - 1] as HTMLInputElement;
                            prevInput?.focus();
                          }
                        }}
                        style={{
                          width: '48px',
                          height: '56px',
                          fontSize: '22px',
                          fontWeight: '700',
                          textAlign: 'center',
                          border: '3px solid #e0e0e0',
                          borderRadius: '10px',
                          background: 'white',
                          color: '#374151',
                          outline: 'none',
                          transition: 'all 0.2s ease'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.border = '3px solid #8b5cf6';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.border = '3px solid #e0e0e0';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                /* Multiple choice interface */
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '19.2px'
                }}>
                  {options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleOptionClick(index)}
                      style={{
                        minWidth: '96px',
                        height: '64px',
                        borderRadius: '16px',
                        background: selectedOption === index 
                          ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                          : 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                        border: selectedOption === index ? '2.4px solid #7c3aed' : '2.4px solid #e0e0e0',
                        cursor: 'pointer',
                        fontSize: '25.6px',
                        fontWeight: '700',
                        color: selectedOption === index ? 'white' : '#424242',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: selectedOption === index 
                          ? '0 6.4px 19.2px rgba(124, 58, 237, 0.35)'
                          : '0 3.2px 9.6px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = 'scale(0.95)';
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Question prompt - only show for regular questions, not blending or speech */}
      {/* Removed duplicate prompt (now shown above image) */}

      {/* Submit button - only for regular and long A questions */}
      {!isSpeechQuestion && !isBlendingQuestion && !showFeedback && (currentRegularQuestion || currentLongAQuestion) && (
        (currentLongAQuestion && currentLongAQuestion.isSorting) 
          ? Object.values(sortingAnswers).flat().length >= (currentLongAQuestion.sortingWords?.length || 0)
          : ((currentRegularQuestion && (currentRegularQuestion.isSpelling || currentRegularQuestion.isFillBlank)) || 
             (currentLongAQuestion && (currentLongAQuestion.isSpelling || currentLongAQuestion.isFillBlank)))
            ? (currentLongAQuestion?.isFillBlank 
                ? spellingInput.length >= 2  // For fill-in-the-blank, need at least 2 letters (ai)
                : spellingInput.length >= Math.min(3, ((currentRegularQuestion?.correctAnswer || currentLongAQuestion?.correctAnswer) as string).length))
            : selectedOption !== null
      ) && (
        <div style={{
          marginTop: '32px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <button
            onClick={handleSubmit}
            style={{
              minWidth: '128px',
              height: '48px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '700',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6.4px 19.2px rgba(79, 70, 229, 0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Submit
          </button>
        </div>
      )}

      {/* Feedback section - only for regular and long A questions */}
      {!isSpeechQuestion && showFeedback && !isFeedbackRemoved && (
        <div style={{
          marginTop: '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px'
        }}>
                    {/* Combined feedback + explanation container (compact) */}
          <div style={{
            padding: '16px 20px',
            borderRadius: '20px',
            background: isCorrect 
              ? '#10b981'
              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            textAlign: 'center',
            boxShadow: isCorrect 
              ? '0 12px 0 rgba(156,126,172,0.25), 0 24px 64px rgba(0,0,0,0.15)'
              : '0 8px 24px rgba(239, 68, 68, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            maxWidth: '720px',
            minWidth: '720px',
            margin: '0 auto'
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: 700,
              lineHeight: 1.5,
              width: '100%'
            }} className={isContinuationStep ? (isContinuationAnimating ? 'fade-out' : '') : ''}>
              {/* Show user's response if validated for Step 5 only, otherwise show the CTA */}
              {isCorrect && isContinuationStep && isContinuationHidden && validatedContinuation && isFirstRegularStep ? (
                <div style={{
                  fontFamily: 'Quicksand, sans-serif',
                  fontWeight: 500,
                  color: 'white',
                  fontSize: '18px',
                  lineHeight: 1.5
                }}>
                  {validatedContinuation}
                </div>
              ) : isCorrect && isContinuationStep && isContinuationHeaderLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <span>Creating your story...</span>
                </div>
              ) : isCorrect && isContinuationStep && (validationMessage || continuationHeader) ? (
                <span>
                  {validationMessage || continuationHeader}
                  <button
                    onClick={async () => { 
                      const line = validationMessage || continuationHeader;
                      const label = String(line || '').trim();
                      if (!label) return;
                      if (currentElevenLabelRef.current === label) {
                        audioManager.stopAll();
                        currentElevenLabelRef.current = null;
                        return;
                      }
                      currentElevenLabelRef.current = label;
                      await playElevenTTS(label);
                    }}
                    title={(() => { const line = validationMessage || continuationHeader; return currentElevenLabelRef.current === String(line || '').trim() ? 'Stop' : 'Hear'; })()}
                    style={{
                      marginLeft: 10,
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.6)',
                      background: 'rgba(255,255,255,0.25)',
                      cursor: 'pointer'
                    }}
                  >🔊</button>
                </span>
              ) : isCorrect && !isContinuationStep ? (
                (currentRegularQuestion?.explanation || currentLongAQuestion?.explanation) || 'Great job!'
              ) : !isCorrect ? (
                isIncorrectHintLoading
                  ? 'Thinking of a hint…'
                  : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span>{incorrectHint || ((currentRegularQuestion?.isSpelling || currentLongAQuestion?.isSpelling)
                        ? 'Listen again and try your best.'
                        : `Listen to the word "${(currentRegularQuestion?.word || currentLongAQuestion?.word) || 'this word'}" again. What sound do you hear at the beginning?`)}</span>
                      {incorrectHint && (
                        <button
                          onClick={async () => {
                            const label = String(incorrectHint || '').trim();
                            if (!label) return;
                            if (currentElevenLabelRef.current === label) {
                              audioManager.stopAll();
                              currentElevenLabelRef.current = null;
                              return;
                            }
                            currentElevenLabelRef.current = label;
                            await playElevenTTS(label);
                          }}
                          title={(() => { const line = incorrectHint; return currentElevenLabelRef.current === String(line || '').trim() ? 'Stop' : 'Hear'; })()}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.6)',
                            background: 'rgba(255,255,255,0.25)',
                            cursor: 'pointer'
                          }}
                        >🔊</button>
                      )}
                    </span>
                  )
              ) : null}
            </div>

            {/* Continuation input row with mic and icon CTAs */}
            {isCorrect && isContinuationStep && !isContinuationHidden && (
              <div style={{
                marginTop: '12px',
                width: '100%',
                display: 'grid',
                gridTemplateColumns: '1fr 44px 44px 44px',
                gap: '8px',
                alignItems: 'center'
              }}>
                <textarea
                  value={continuationInput}
                  onChange={(e) => setContinuationInput(e.target.value)}
                  placeholder="Type your 1–2 sentences here"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmitContinuation(); }
                    // FEATURE FLAG: Disable image generation keyboard shortcut
                    if (ENABLE_CONTINUATION_IMAGE_GENERATION && (e.metaKey || e.ctrlKey) && e.key === 'Enter') { 
                      e.preventDefault(); 
                      void startImageFromContinuation(); 
                    }
                  }}
                  style={{
                    width: '100%',
                    borderRadius: 9999,
                    border: '2px solid rgba(59,130,246,0.6)',
                    padding: '10px 16px',
                    resize: 'none',
                    minHeight: '40px',
                    maxHeight: '64px',
                    outline: 'none',
                    boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.6)'
                  }}
                />
                {/* Microphone button for speech input */}
                <button
                  onClick={isContRecording ? stopContinuationRecording : startContinuationRecording}
                  title={isContRecording ? "Stop recording" : "Record your response"}
                  aria-label={isContRecording ? "Stop recording" : "Record your response"}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: isContRecording 
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                      : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    border: '1px solid rgba(255,255,255,0.6)',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isContRecording 
                      ? '0 4px 12px rgba(239, 68, 68, 0.3)' 
                      : '0 2px 8px rgba(59, 130, 246, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isContRecording ? (
                    <div style={{ width: 12, height: 12, background: 'white', borderRadius: 2 }} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="white"/>
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="white"/>
                    </svg>
                  )}
                </button>
                {/* Icon CTA: Create Image - DISABLED BY FEATURE FLAG */}
                {ENABLE_CONTINUATION_IMAGE_GENERATION && (
                  <button
                    onClick={startImageFromContinuation}
                    title="Create image from this response"
                    aria-label="Create image from this response"
                    disabled={!continuationInput.trim()}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: continuationInput.trim() ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#9ca3af',
                      border: '1px solid rgba(255,255,255,0.6)',
                      color: 'white',
                      cursor: continuationInput.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}
                  >
                    <span role="img" aria-label="Create Image">🌄</span>
                  </button>
                )}
                {/* Icon CTA: Continue story */}
                <button
                  onClick={handleSubmitContinuation}
                  title="Submit and continue the story"
                  aria-label="Submit and continue the story"
                  disabled={!continuationInput.trim()}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: continuationInput.trim() ? 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)' : '#9ca3af',
                    color: '#111827',
                    border: '1px solid rgba(255,255,255,0.6)',
                    cursor: continuationInput.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 800,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                  }}
                >
                  ➤
                </button>
              </div>
            )}

            {/* Removed separate white card - user response now shows inside green container */}
          </div>

          {/* Action buttons (no Next button when correct) */}
          <div style={{ display: 'flex', gap: '16px' }}>
            {!isCorrect && (
              <button
                onClick={handleTryAgain}
                style={{
                  minWidth: '140px',
                  height: '50px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'white',
                  boxShadow: '0 6px 20px rgba(245, 158, 11, 0.3)',
                  transition: 'all 0.2s ease',
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.95)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                Try Again
              </button>
            )}

            {/* No next button here when correct to keep the box compact */}
          </div>

          {/* Step 5 continuation experiment moved into green container above */}
        </div>
      )}

      {/* Step-level Retry: top-right, left of Step x of y */}
      {isFirstRegularStep && (
        <button
          onClick={() => {
            setHasGeneratedSummary(false);
            setHasAutoplayedSummary(false);
            setAiSummary('');
            setValidatedContinuation('');
            setShowFeedback(false);
            setIsCorrect(false);
            setHasAutoplayedContPrompt(false);
            setIsContinuationHidden(false);
            setContinuationInput('');
            setValidationMessage('');
            setIsFeedbackRemoved(false);
            // Remove the most recent continuation from story context if it matches
            setStoryContext(prev => {
              if (!validatedContinuation) return prev;
              if (prev.length === 0) return prev;
              const lastIdx = prev.length - 1;
              return prev[lastIdx] === validatedContinuation ? prev.slice(0, lastIdx) : prev;
            });
          }}
          title="Retry"
          style={{
            position: 'absolute',
            top: '16px',
            right: '140px',
            zIndex: 11,
            minWidth: '96px',
            height: '38.4px',
            borderRadius: '12.8px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12.8px',
            fontWeight: 700,
            boxShadow: '0 6.4px 19.2px rgba(245, 158, 11, 0.35)'
          }}
        >
          ↻ Retry
        </button>
      )}

      {/* Subtle Next button - top right, almost invisible */}
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 10 }}>
        <button
          onClick={handleNext}
          style={{
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
            e.currentTarget.style.opacity = '0.2';
            e.currentTarget.style.background = 'rgba(156,163,175,0.1)';
            e.currentTarget.style.color = 'rgba(107,114,128,0.3)';
          }}
          title="Next"
          aria-label="Next question (subtle)"
        >
          →
        </button>
      </div>

      {/* Always visible Previous button - bottom left */}
      <div style={{ position: 'fixed', bottom: '16px', left: '16px', zIndex: 10 }}>
        <button
          onClick={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0}
          style={{
            minWidth: '96px',
            height: '38.4px',
            borderRadius: '12.8px',
            background: 'linear-gradient(135deg, #E5E7EB 0%, #D1D5DB 100%)',
            color: '#374151',
            border: 'none',
            cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
            fontSize: '12.8px',
            fontWeight: 700,
            boxShadow: '0 6.4px 19.2px rgba(156,163,175,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6.4px',
            opacity: currentQuestionIndex === 0 ? 0.6 : 1
          }}
          onMouseDown={(e) => {
            if (currentQuestionIndex !== 0) e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={currentQuestionIndex === 0 ? 'No previous question' : 'Go to previous question'}
          aria-label="Previous question"
        >
          ⬅️ Previous
        </button>
      </div>

      {/* Global navigation - bottom right (dev mode only) */}
      <div style={{ position: 'fixed', bottom: '16px', right: '16px', display: isDevModeActive ? 'flex' : 'none', gap: '9.6px', zIndex: 10 }}>
        <button
          onClick={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0}
          style={{
            minWidth: '96px',
            height: '38.4px',
            borderRadius: '12.8px',
            background: 'linear-gradient(135deg, #E5E7EB 0%, #D1D5DB 100%)',
            color: '#374151',
            border: 'none',
            cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
            fontSize: '12.8px',
            fontWeight: 700,
            boxShadow: '0 6.4px 19.2px rgba(156,163,175,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6.4px',
            opacity: currentQuestionIndex === 0 ? 0.6 : 1
          }}
          onMouseDown={(e) => {
            if (currentQuestionIndex !== 0) e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={currentQuestionIndex === 0 ? 'No previous question' : 'Go to previous question'}
          aria-label="Previous question"
        >
          ⬅️ Previous
        </button>
        <button
          onClick={handleNext}
          style={{
            minWidth: '96px',
            height: '38.4px',
            borderRadius: '12.8px',
            background: 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12.8px',
            fontWeight: 700,
            boxShadow: '0 6.4px 19.2px rgba(107,114,128,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6.4px'
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Next question"
          aria-label="Next question"
        >
          Next ➡️
        </button>
      </div>
      </div>

      {/* Removed bottom-right speech bubble; user continuation now appears inline in the green box area */}
    </>
  );
}
