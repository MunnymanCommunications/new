import { useState, useRef, useCallback, useEffect } from 'react';
import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  FunctionDeclaration,
  Type,
} from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audio.ts';
import type { ConversationStatus } from '../types.ts';
import { getSupabase } from '../lib/supabaseClient.ts';

type LiveSession = Awaited<ReturnType<InstanceType<typeof GoogleGenAI>['live']['connect']>>;

const saveToMemoryFunctionDeclaration: FunctionDeclaration = {
  name: 'saveToMemory',
  description: 'Saves a piece of information that the user explicitly asks to be remembered. Only use this when the user says "remember that", "save this", or a similar direct command.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      info: {
        type: Type.STRING,
        description: 'The specific piece of information to save.',
      },
    },
    required: ['info'],
  },
};

interface UseGeminiLiveProps {
  assistantId: string;
  voice: string;
  systemInstruction: string;
  onSaveToMemory: (info: string) => Promise<void>;
  onTurnComplete: (userTranscript: string, assistantTranscript: string) => void;
}

export function useGeminiLive({
  assistantId,
  voice,
  systemInstruction,
  onSaveToMemory,
  onTurnComplete,
}: UseGeminiLiveProps) {
  const [sessionStatus, setSessionStatus] = useState<ConversationStatus>('IDLE');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [assistantTranscript, setAssistantTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<LiveSession | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  useEffect(() => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === 'undefined') {
      setError('API key is not configured. Please set VITE_API_KEY in your environment.');
      setSessionStatus('ERROR');
      return;
    }
    aiRef.current = new GoogleGenAI({ apiKey });
  }, []);

  const logEvent = useCallback(async (
    eventType: 'SESSION_START' | 'SESSION_END' | 'API_ERROR',
    metadata?: Record<string, any>
  ) => {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('app_logs').insert({
      user_id: user.id,
      assistant_id: assistantId,
      event_type: eventType,
      metadata: metadata,
    });
    if (error) {
        console.error(`Failed to log event ${eventType}:`, error);
    }
  }, [assistantId]);
  
  const handleError = useCallback((errorMessage: string, e?: ErrorEvent | unknown) => {
    if(e) console.error('Session error:', e);
    setError(errorMessage);
    setSessionStatus('ERROR');
    logEvent('API_ERROR', { error_message: errorMessage });
  }, [logEvent]);

  const stopSession = useCallback(async (isError: boolean = false) => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }

    if (sessionStartTimeRef.current && !isError) {
      const duration_ms = Date.now() - sessionStartTimeRef.current;
      logEvent('SESSION_END', { duration_ms });
    }
    sessionStartTimeRef.current = null;

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
      microphoneStreamRef.current = null;
    }
    
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      await inputAudioContextRef.current.close();
    }
    inputAudioContextRef.current = null;

    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      await outputAudioContextRef.current.close();
    }
    outputAudioContextRef.current = null;
    
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
    setIsSpeaking(false);
    nextStartTimeRef.current = 0;

    if (!isError) {
      setSessionStatus('IDLE');
      setUserTranscript('');
      setAssistantTranscript('');
      setError(null);
    }
  }, [logEvent]);

  const startSession = useCallback(async () => {
    setError(null);
    setSessionStatus('CONNECTING');

    if (!aiRef.current) {
      handleError('Gemini AI client is not initialized.');
      return;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      handleError('Your browser does not support audio recording.');
      return;
    }
    
    try {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        nextStartTimeRef.current = 0;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphoneStreamRef.current = stream;

        const sessionPromise = aiRef.current.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    setSessionStatus('ACTIVE');
                    sessionStartTimeRef.current = Date.now();
                    logEvent('SESSION_START');
                    
                    const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                    mediaStreamSourceRef.current = source;
                    
                    const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContextRef.current!.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        const newText = message.serverContent.inputTranscription.text;
                        currentInputTranscriptionRef.current += newText;
                        setUserTranscript(currentInputTranscriptionRef.current);
                    }
                    if (message.serverContent?.outputTranscription) {
                        const newText = message.serverContent.outputTranscription.text;
                        currentOutputTranscriptionRef.current += newText;
                        setAssistantTranscript(currentOutputTranscriptionRef.current);
                    }
                    if (message.serverContent?.turnComplete) {
                        onTurnComplete(currentInputTranscriptionRef.current, currentOutputTranscriptionRef.current);
                        currentInputTranscriptionRef.current = '';
                        currentOutputTranscriptionRef.current = '';
                    }

                    if (message.toolCall?.functionCalls) {
                        for (const fc of message.toolCall.functionCalls) {
                            if (fc.name === 'saveToMemory') {
                                try {
                                    const info = fc.args?.info;
                                    if (typeof info === 'string') {
                                        await onSaveToMemory(info);
                                        sessionPromise.then(session => session.sendToolResponse({
                                            functionResponses: {
                                                id: fc.id,
                                                name: fc.name,
                                                response: { result: "Successfully saved to memory." }
                                            }
                                        }));
                                    } else {
                                        sessionPromise.then(session => session.sendToolResponse({
                                             functionResponses: {
                                                id: fc.id,
                                                name: fc.name,
                                                response: { result: "Failed to save to memory, info was not provided." }
                                            }
                                        }));
                                    }
                                } catch (e) {
                                    console.error("Failed to save to memory:", e);
                                    sessionPromise.then(session => session.sendToolResponse({
                                         functionResponses: {
                                            id: fc.id,
                                            name: fc.name,
                                            response: { result: "Failed to save to memory." }
                                        }
                                    }));
                                }
                            }
                        }
                    }

                    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (base64Audio && outputAudioContextRef.current) {
                        if (speakingTimeoutRef.current) {
                            clearTimeout(speakingTimeoutRef.current);
                            speakingTimeoutRef.current = null;
                        }
                        setIsSpeaking(true);

                        const audioBytes = decode(base64Audio);
                        const audioBuffer = await decodeAudioData(
                            audioBytes,
                            outputAudioContextRef.current,
                            24000,
                            1
                        );
                        const source = outputAudioContextRef.current.createBufferSource();
                        source.buffer = audioBuffer;
                        const outputNode = outputAudioContextRef.current.createGain();
                        outputNode.connect(outputAudioContextRef.current.destination);
                        source.connect(outputNode);
                        
                        source.onended = () => {
                            sourcesRef.current.delete(source);
                            if (sourcesRef.current.size === 0) {
                                speakingTimeoutRef.current = setTimeout(() => setIsSpeaking(false), 200);
                            }
                        };
                        sourcesRef.current.add(source);

                        const currentTime = outputAudioContextRef.current.currentTime;
                        const startTime = Math.max(currentTime, nextStartTimeRef.current);
                        source.start(startTime);
                        nextStartTimeRef.current = startTime + audioBuffer.duration;
                    }
                    
                    if (message.serverContent?.interrupted) {
                       sourcesRef.current.forEach(source => source.stop());
                       sourcesRef.current.clear();
                       setIsSpeaking(false);
                       nextStartTimeRef.current = 0;
                    }
                },
                onerror: (e: ErrorEvent) => {
                    handleError('A connection error occurred.', e);
                    stopSession(true);
                },
                onclose: () => {
                    // This is called on explicit close or network issues.
                    // The main stopSession logic handles state changes.
                },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
                },
                systemInstruction: systemInstruction,
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                tools: [{ functionDeclarations: [saveToMemoryFunctionDeclaration] }],
            },
        });
        
        sessionRef.current = await sessionPromise;

    } catch (err: any) {
      handleError(err.message || 'Failed to start the microphone.', err);
      stopSession(true);
    }
  }, [voice, systemInstruction, onSaveToMemory, onTurnComplete, stopSession, logEvent, handleError]);

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  return {
    sessionStatus,
    startSession,
    stopSession,
    isSpeaking,
    userTranscript,
    assistantTranscript,
    error,
  };
}
