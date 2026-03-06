import { Mic, MicOff } from 'lucide-react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useCallback } from 'react';

interface VoiceInputButtonProps {
  /** Called with recognized text (appended to existing value) */
  onTranscript: (text: string) => void;
  /** Show interim text while speaking */
  onInterim?: (text: string) => void;
  /** Language (default: de-DE) */
  lang?: string;
  /** Button size in px (default: 14) */
  size?: number;
  /** Additional CSS class */
  className?: string;
}

export default function VoiceInputButton({
  onTranscript,
  onInterim,
  lang = 'de-DE',
  size = 14,
  className = '',
}: VoiceInputButtonProps) {
  const handleResult = useCallback((transcript: string) => {
    onTranscript(transcript);
  }, [onTranscript]);

  const {
    isSupported,
    isListening,
    toggleListening,
    error,
  } = useVoiceInput({
    lang,
    onResult: handleResult,
    onInterim,
    continuous: false,
  });

  if (!isSupported) return null;

  return (
    <button
      type="button"
      className={`voice-input-btn ${isListening ? 'listening' : ''} ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleListening();
      }}
      title={isListening ? 'Spracheingabe stoppen' : error || 'Spracheingabe starten'}
      aria-label={isListening ? 'Spracheingabe stoppen' : 'Spracheingabe starten'}
    >
      {isListening ? <MicOff size={size} /> : <Mic size={size} />}
      {isListening && <span className="voice-pulse" />}
    </button>
  );
}
