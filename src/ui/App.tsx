import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { ChatPanel } from './ChatPanel';
import { ImagePanel } from './ImagePanel';
import { QuestionPanel } from './QuestionPanel';
import { LandingPage } from './LandingPage';
import { PictureBook } from './PictureBook';
import { LondonPictureBook } from './LondonPictureBook';
import { ConnorPictureBook } from './ConnorPictureBook';
import { PetPage } from './PetPage';
import { Button } from './components/Button';
import { analytics } from '../analytics/posthog';

export function App(): JSX.Element {
  // Feature flags
  const ENABLE_CHAT_PANEL = false; // Set to true to enable chat panel
  
  // Landing page state
  const [showLandingPage, setShowLandingPage] = useState(true);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [storyMode, setStoryMode] = useState<'adventure' | 'picture-book'>('picture-book');
  const [currentWorld, setCurrentWorld] = useState<'asher' | 'connor'>('asher');
  const [showPetPage, setShowPetPage] = useState(false);

  // Practice loop state (placeholder assets, no DALL·E)
  const [chapter, setChapter] = useState<1 | 2>(1);
  const [progress, setProgress] = useState(0); // 0..3
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false); // collapsed by default

  const chapterImages = useMemo(() => {
    // Four states per chapter: 0 start, 1, 2, 3 complete
    const ch1 = [
      'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=1600&auto=format&fit=crop'
    ];
    const ch2 = [
      'https://images.unsplash.com/photo-1462332420958-a05d1e002413?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1491975474562-1f4e30bc9468?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop'
    ];
    return chapter === 1 ? ch1 : ch2;
  }, [chapter]);

  const questions = useMemo(() => {
    if (chapter === 1) {
      return [
        { id: 'q1', type: 'mc', prompt: 'Where are London and her team?', options: ['A snowy mountain', 'A magical enchanted bakery', 'Under the ocean'], correct: 1 },
        { id: 'q2', type: 'spelling', prompt: 'Fix the word from the story:', target: 'oven', options: ['ovven', 'oven', 'oveen'], correct: 1 },
        { id: 'bonus', type: 'micro', prompt: 'Who is London\'s giant cupcake monster friend?', options: ['Sprinkle Beast', 'Clay'], correct: 0 }
      ] as const;
    }
    return [
      { id: 'q1', type: 'mc', prompt: 'Why does London use magical tools?', options: ['To create perfect treats', 'To build a camp', 'To plant trees'], correct: 0 },
      { id: 'q2', type: 'order', prompt: 'Arrange the sentence:', fragments: ['Sprinkle Beast mixes', 'the magical batter', 'with care'], order: [0,1,2] },
      { id: 'bonus', type: 'micro', prompt: 'Which cupcake monster helps in the bakery?', options: ['Sprinkle Beast', 'Clay'], correct: 0 }
    ] as const;
  }, [chapter]);

  const [questionIndex, setQuestionIndex] = useState(0); // 0..1 -> main questions, then bonus if needed
  const [selected, setSelected] = useState<number | null>(null);
  const [fragmentsOrder, setFragmentsOrder] = useState<number[]>([]);

  // Analytics: Track page views based on app state
  useEffect(() => {
    if (showLandingPage) {
      analytics.page('Landing Page');
    } else if (selectedStoryId && storyMode === 'picture-book') {
      analytics.page('Picture Book', {
        story_id: selectedStoryId,
        current_world: currentWorld,
      });
    } else if (selectedStoryId && storyMode === 'adventure') {
      analytics.page('Adventure Mode', {
        story_id: selectedStoryId,
        chapter: chapter,
        progress: progress,
      });
    } else if (selectedStoryId === 'new-story') {
      analytics.page('New Story Creation');
    }
  }, [showLandingPage, selectedStoryId, storyMode, currentWorld, chapter, progress]);

  // Analytics: Set user properties based on preferences and progress
  useEffect(() => {
    analytics.setUserProperties({
      preferred_story_mode: storyMode,
      current_chapter: chapter,
      current_progress: progress,
      current_world: currentWorld,
      last_selected_story: selectedStoryId,
      last_activity: new Date().toISOString(),
    });
  }, [storyMode, chapter, progress, currentWorld, selectedStoryId]);

  const startChapter = useCallback(() => {
    setError(null);
    setShowWin(false);
    setVideoUrl(null);
    setProgress(0);
    setQuestionIndex(0);
    setSelected(null);
    setFragmentsOrder([]);
    setImageUrl(chapterImages[0] ?? null);
  }, [chapterImages]);

  const handleGenerate = useCallback((_: string) => {
    // repurpose Create Image button to start or advance chapter
    if (!imageUrl || showWin) {
      startChapter();
    } else {
      // If chapter is in progress and user clicks button again, re-show current state
      setImageUrl(chapterImages[Math.min(progress, 3)] ?? null);
    }
  }, [imageUrl, showWin, startChapter, chapterImages, progress]);

  // Landing page handlers
  const handleSelectStory = useCallback((storyId: string, mode: 'adventure' | 'picture-book' = 'picture-book') => {
    console.log('Selected story:', storyId, 'mode:', mode);
    
    // Analytics: Track story selection
    analytics.track('Story Selected', {
      story_id: storyId,
      mode: mode,
      timestamp: new Date().toISOString(),
    });
    
    setSelectedStoryId(storyId);
    setStoryMode(mode);
    setShowLandingPage(false);
  }, []);

  const handleCreateNewStory = useCallback(() => {
    console.log('Creating new story');
    
    // Analytics: Track new story creation
    analytics.track('New Story Created', {
      timestamp: new Date().toISOString(),
    });
    
    setSelectedStoryId('new-story');
    setShowLandingPage(false);
  }, []);

  const handleBackToLibrary = useCallback(() => {
    // Analytics: Track navigation back to library
    analytics.track('Back to Library', {
      from_story_id: selectedStoryId,
      from_mode: storyMode,
      timestamp: new Date().toISOString(),
    });
    
    setShowLandingPage(true);
    setSelectedStoryId(null);
    setStoryMode('picture-book');
    setCurrentWorld('asher');
    setShowPetPage(false);
  }, [selectedStoryId, storyMode]);

  const handleOpenPets = useCallback(() => {
    console.log('Opening pet page');
    
    // Analytics: Track pet page navigation
    analytics.track('Pet Page Opened', {
      timestamp: new Date().toISOString(),
    });
    
    setShowLandingPage(false);
    setShowPetPage(true);
    setSelectedStoryId(null);
  }, []);

  const handleBackFromPets = useCallback(() => {
    // Analytics: Track navigation back from pets
    analytics.track('Back from Pets', {
      timestamp: new Date().toISOString(),
    });
    
    setShowLandingPage(true);
    setShowPetPage(false);
  }, []);

  const handleNextWorld = useCallback(() => {
    // Analytics: Track world navigation
    analytics.track('World Navigation', {
      from_world: currentWorld,
      to_world: 'connor',
      story_id: selectedStoryId,
      timestamp: new Date().toISOString(),
    });
    
    setCurrentWorld('connor');
  }, [currentWorld, selectedStoryId]);

  const handlePreviousWorld = useCallback(() => {
    // Analytics: Track world navigation
    analytics.track('World Navigation', {
      from_world: currentWorld,
      to_world: 'asher',
      story_id: selectedStoryId,
      timestamp: new Date().toISOString(),
    });
    
    setCurrentWorld('asher');
  }, [currentWorld, selectedStoryId]);

  // Picture book data
  const stellaStoryPages = useMemo(() => [
    {
      id: 'page-1',
      pageNumber: 1,
      text: 'In a quiet forest full of mist and magic, lived a girl named Stella. She wore ragged clothes and had only one friend—a tiny frog in a mossy leaf poncho.',
      imageUrl: undefined
    },
    {
      id: 'page-2',
      pageNumber: 2,
      text: 'One morning, the frog hopped away into the trees. Stella followed, calling out—but he was gone.',
      imageUrl: undefined
    },
    {
      id: 'page-3',
      pageNumber: 3,
      text: 'Just then, a glowing lantern floated down from the sky. Inside was a shimmering map… pointing the way to her lost friend.',
      imageUrl: undefined
    },
    {
      id: 'page-4',
      pageNumber: 4,
      text: 'Stella set off on the path. She spotted a chicken guarding some shiny eggs. She tried to catch them with a net, but they vanished with a puff!',
      imageUrl: undefined
    },
    {
      id: 'page-5',
      pageNumber: 5,
      text: 'In the nest, she found only a wiggly bug. She sighed, ate it, and declared, "No more eggs for me!"',
      imageUrl: undefined
    },
    {
      id: 'page-6',
      pageNumber: 6,
      text: 'Suddenly, a single egg appeared in the nest. Stella gently returned it to the chicken, who clucked happily and danced away.',
      imageUrl: undefined
    },
    {
      id: 'page-7',
      pageNumber: 7,
      text: 'High above, a jet zoomed through the sky. A woman in fancy clothes tossed something out—Stella gasped!',
      imageUrl: undefined
    },
    {
      id: 'page-8',
      pageNumber: 8,
      text: 'It was a tiny brown dog! Stella raced forward and caught him just in time. "You\'re safe," she whispered.',
      imageUrl: undefined
    },
    {
      id: 'page-9',
      pageNumber: 9,
      text: 'She named him Robber. He wagged his tail and trotted beside her, brave and proud.',
      imageUrl: undefined
    },
    {
      id: 'page-10',
      pageNumber: 10,
      text: 'As they walked deeper into the forest, something blinked at them from the grass... A second frog—smaller than a pebble—peeked out and gave a tiny croak.',
      imageUrl: undefined
    },
    {
      id: 'page-11',
      pageNumber: 11,
      text: 'Stella scooped him up gently. "You\'re coming with us too," she smiled. Now she had Robber... and two frog friends.',
      imageUrl: undefined
    },
    {
      id: 'page-12',
      pageNumber: 12,
      text: 'The glowing map shimmered again—revealing a new path. With her animal friends by her side, Stella took a deep breath... and stepped into the unknown.',
      imageUrl: undefined
    },
    {
      id: 'page-13',
      pageNumber: 13,
      text: 'Chapter 2\n\n to be continued',
      imageUrl: undefined
    }
  ], []);

  function onAnswer(): void {
    const q = questions[questionIndex];
    if (!q) return;
    let correct = false;
    if (q.type === 'mc' || q.type === 'spelling' || q.type === 'micro') {
      correct = selected === q.correct;
    } else if (q.type === 'order') {
      correct = JSON.stringify(fragmentsOrder) === JSON.stringify(q.order);
    }
    
    // Analytics: Track question attempt
    analytics.track('Question Answered', {
      question_id: q.id,
      question_type: q.type,
      correct: correct,
      chapter: chapter,
      progress: progress,
      question_index: questionIndex,
      selected_answer: selected,
      timestamp: new Date().toISOString(),
    });
    
    if (!correct) return;

    const newProgress = Math.min(progress + 1, 3);
    setProgress(newProgress);
    setImageUrl(chapterImages[newProgress] ?? null);

    // Advance to next question or bonus
    if (newProgress >= 3) {
      setShowWin(true);
      
      // Analytics: Track chapter completion
      analytics.track('Chapter Completed', {
        chapter: chapter,
        final_progress: newProgress,
        questions_answered: questionIndex + 1,
        timestamp: new Date().toISOString(),
      });
      
      // Kick off video creation in background
      setVideoLoading(true);
      void (async () => {
        try {
          const res = await fetch('/api/video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'London\'s progress through the magical bakery: oven stabilizes, magical tools appear, harmony restored.', durationSeconds: 8, aspectRatio: '16:9' }) });
          const data = await res.json();
          setVideoUrl(data?.url ?? null);
        } catch {
          setVideoUrl(null);
        } finally {
          setVideoLoading(false);
        }
      })();
    } else {
      setQuestionIndex(prev => {
        if (prev === 0) return 1; // second question
        // after two main questions, use bonus until reach 3
        return 2; // bonus index
      });
      setSelected(null);
    }
  }

  // Show pet page
  if (showPetPage) {
    return (
      <PetPage 
        onBack={handleBackFromPets}
      />
    );
  }

  // Show landing page first
  if (showLandingPage) {
    return (
      <LandingPage 
        onSelectStory={handleSelectStory}
        onCreateNewStory={handleCreateNewStory}
        onOpenPets={handleOpenPets}
      />
    );
  }

  // Show picture book for older story (Stella and tiny frog)
  if (selectedStoryId === 'stella-tiny-frog' && storyMode === 'picture-book') {
    return (
      <PictureBook
        title="Stella and the Tiny Frog"
        author="by Irene, 2nd grade"
        pages={stellaStoryPages}
        onBack={handleBackToLibrary}
      />
    );
  }

  // Show AsherPictureBook for Asher's space adventure
  if (selectedStoryId === 'captain-asher-time-stranglers' && storyMode === 'picture-book') {
    if (currentWorld === 'asher') {
      return (
        <LondonPictureBook
          onBack={handleBackToLibrary}
          onNext={handleNextWorld}
        />
      );
    } else if (currentWorld === 'connor') {
      return (
        <ConnorPictureBook
          onBack={handleBackToLibrary}
          onPrevious={handlePreviousWorld}
        />
      );
    }
  }

  // Show new LondonPictureBook for London's adventure
  if (selectedStoryId === 'london-magical-bakery' && storyMode === 'picture-book') {
    if (currentWorld === 'asher') {
      return (
        <LondonPictureBook
          onBack={handleBackToLibrary}
          onNext={handleNextWorld}
        />
      );
    } else if (currentWorld === 'connor') {
      return (
        <ConnorPictureBook
          onBack={handleBackToLibrary}
          onPrevious={handlePreviousWorld}
        />
      );
    }
  }
  
  // Show adventure mode for any story (when mode is adventure) or new story creation
  if ((selectedStoryId === 'london-magical-bakery' && storyMode === 'adventure') || (selectedStoryId === 'captain-asher-time-stranglers' && storyMode === 'adventure') || (selectedStoryId === 'two-sisters' && storyMode === 'adventure') || selectedStoryId === 'new-story') {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${ENABLE_CHAT_PANEL && isChatOpen ? '420px' : '0px'} 1fr`,
        gridTemplateRows: '100%',
        height: '100%',
        width: '100%',
        transition: 'grid-template-columns 200ms ease'
      }}>
        {/* Chat column */}
        <div
          id="chat-panel"
          aria-hidden={!isChatOpen}
          style={{
            borderRight: ENABLE_CHAT_PANEL && isChatOpen ? '1px solid #E5E7EB' : 'none',
            background: '#FFFFFF',
            overflow: 'hidden',
            pointerEvents: ENABLE_CHAT_PANEL && isChatOpen ? 'auto' : 'none'
          }}
        >
          {ENABLE_CHAT_PANEL && isChatOpen && <ChatPanel onGenerateImage={handleGenerate} />}
        </div>
        {/* Main column */}
        <div style={{ position: 'relative' }}>
          {/* Back to Library button */}
          <button
            onClick={handleBackToLibrary}
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              zIndex: 20,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              fontFamily: 'Quicksand, system-ui, sans-serif'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            📚 Back to Library
          </button>
          
          {/* Toggle chat arrow */}
          {ENABLE_CHAT_PANEL && (
            <button
              onClick={() => setIsChatOpen(v => !v)}
              aria-controls="chat-panel"
              aria-expanded={isChatOpen}
              style={{
                position: 'absolute',
                top: '50%',
                left: 8,
                transform: 'translateY(-50%)',
                zIndex: 20,
                width: 44,
                height: 44,
                borderRadius: 9999,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                border: '2px solid rgba(255,255,255,0.6)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(-50%) scale(0.95)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
              title={isChatOpen ? 'Collapse chat' : 'Expand chat'}
              aria-label={isChatOpen ? 'Collapse chat' : 'Expand chat'}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>
                {isChatOpen ? '◀' : '▶'}
              </span>
            </button>
          )}

          <QuestionPanel
            selectedStoryId={selectedStoryId}
            onComplete={() => {
              console.log('All questions completed!');
              // Handle completion logic here
            }}
            onNavigateToPetStore={handleOpenPets}
          />
        </div>
      </div>
    );
  }

  // Fallback - should not reach here normally
  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h2>Story not found</h2>
      <button onClick={handleBackToLibrary}>Back to Library</button>
    </div>
  );
}
