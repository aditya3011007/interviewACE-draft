export { };

declare global {
    interface SpeechRecognitionAlternative {
        transcript: string;
    }

    interface SpeechRecognitionResult {
        isFinal: boolean;
        length: number;
        [index: number]: SpeechRecognitionAlternative;
    }

    interface SpeechRecognitionResultList {
        length: number;
        [index: number]: SpeechRecognitionResult;
    }

    interface SpeechRecognitionEvent {
        resultIndex: number;
        results: SpeechRecognitionResultList;
    }

    interface SpeechRecognitionErrorEvent {
        error?: string;
    }

    interface SpeechRecognition {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onstart: (() => void) | null;
        onresult: ((event: SpeechRecognitionEvent) => void) | null;
        onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
    }

    interface SpeechRecognitionConstructor {
        new(): SpeechRecognition;
    }

    interface Window {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }
}