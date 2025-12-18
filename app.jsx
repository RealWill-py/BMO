import React, { useState, useEffect, useRef } from 'react';

const apiKey = ""; 

const App = () => {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState({ text: "", mood: 'idle' });
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  
  // Estados de Interação
  const [leftEyeClosed, setLeftEyeClosed] = useState(false);
  const [rightEyeClosed, setRightEyeClosed] = useState(false);
  const [pettingScore, setPettingScore] = useState(0);
  const [eyePokeTimer, setEyePokeTimer] = useState(null);

  const audioContext = useRef(null);
  const talkInterval = useRef(null);

  // Inicializa o áudio com segurança
  const initAudio = async () => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContext.current.state === 'suspended') {
      await audioContext.current.resume();
    }
  };

  const theme = (() => {
    switch(status.mood) {
      case 'happy': return { bg: '#33ff99', text: '#004a2a', glow: 'rgba(51,255,153,0.4)' };
      case 'angry': return { bg: '#ff3333', text: '#4d0000', glow: 'rgba(255,51,51,0.4)' };
      case 'sad': return { bg: '#002222', text: '#008888', glow: 'rgba(0,34,34,0.4)' };
      case 'surprised': return { bg: '#ffff33', text: '#4d4d00', glow: 'rgba(255,255,51,0.4)' };
      default: return { bg: '#00ffff', text: '#004a4a', glow: 'rgba(0,255,255,0.4)' };
    }
  })();

  const playPCM = async (base64Data) => {
    try {
      await initAudio();
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Int16Array(len / 2);
      for (let i = 0; i < len; i += 2) {
        bytes[i / 2] = (binaryString.charCodeAt(i + 1) << 8) | binaryString.charCodeAt(i);
      }
      const audioBuffer = audioContext.current.createBuffer(1, bytes.length, 24000);
      audioBuffer.getChannelData(0).set(Array.from(bytes).map(v => v / 32768));
      const source = audioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.current.destination);
      source.onended = () => setIsTalking(false);
      setIsTalking(true);
      source.start();
    } catch (e) {
      console.error(e);
      setIsTalking(false);
    }
  };

  const handleInteraction = async (text, customPrompt = null) => {
    if ((!text.trim() && !customPrompt) || loading) return;
    await initAudio();
    setLoading(true);
    if (!customPrompt) setInput('');

    const userMessage = customPrompt || text;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Aja como um pet virtual minimalista. Responda curto. Retorne JSON: {"text": "fala", "mood": "happy|sad|angry|surprised"}. Contexto: ${userMessage}` }] }]
        })
      });

      const data = await response.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { text: raw.replace(/[{}"]/g, ""), mood: 'happy' };
      
      setStatus(parsed);

      const ttsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Diga fofo: ${parsed.text}` }] }],
          generationConfig: { 
            responseModalities: ["AUDIO"], 
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } 
          }
        })
      });
      const ttsData = await ttsRes.json();
      const pcmData = ttsData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (pcmData) playPCM(pcmData);

      // Reset para idle após 5 segundos
      setTimeout(() => setStatus(prev => ({...prev, mood: 'idle'})), 5000);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const startListening = async () => {
    await initAudio();
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      handleInteraction(transcript);
    };
    recognition.start();
  };

  // Lógica de Carinho
  const handlePetting = () => {
    setPettingScore(prev => {
      const next = prev + 1;
      if (next > 40 && !loading && !isTalking) {
        handleInteraction("", "Alguém está te fazendo carinho e você está amando.");
        return 0;
      }
      return next;
    });
  };

  // Lógica de Cutucada nos Olhos
  const handleEyePoke = (side) => {
    initAudio();
    if (side === 'left') setLeftEyeClosed(true);
    if (side === 'right') setRightEyeClosed(true);

    const timer = setTimeout(() => {
      if (!loading && !isTalking) handleInteraction("", "Alguém está apertando seus olhos e você odeia isso.");
    }, 1500);
    setEyePokeTimer(timer);
  };

  const stopEyePoke = () => {
    setLeftEyeClosed(false);
    setRightEyeClosed(false);
    if (eyePokeTimer) clearTimeout(eyePokeTimer);
  };

  const PetFace = ({ mood, isTalking }) => {
    const color = theme.text;
    const [mouthOpen, setMouthOpen] = useState(false);
    const [blink, setBlink] = useState(false);

    useEffect(() => {
      const b = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 150); }, 5000);
      return () => clearInterval(b);
    }, []);

    useEffect(() => {
      if (isTalking) {
        talkInterval.current = setInterval(() => setMouthOpen(v => !v), 130);
      } else {
        clearInterval(talkInterval.current);
        setMouthOpen(false);
      }
      return () => clearInterval(talkInterval.current);
    }, [isTalking]);

    return (
      <svg width="320" height="200" viewBox="0 0 240 120" className="transition-all duration-500 pointer-events-none">
        {/* Sobrancelhas */}
        <g transform="translate(65, 30)">
          {mood === 'angry' && <path d="M-20,12 L20,-2" stroke={color} strokeWidth="10" strokeLinecap="round" />}
          {mood === 'happy' && <path d="M-15,0 Q0,-10 15,0" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" opacity="0.6" />}
        </g>
        <g transform="translate(175, 30)">
          {mood === 'angry' && <path d="M20,12 L-20,-2" stroke={color} strokeWidth="10" strokeLinecap="round" />}
          {mood === 'happy' && <path d="M-15,0 Q0,-10 15,0" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" opacity="0.6" />}
        </g>

        {/* Olhos */}
        <g transform="translate(65, 60)">
          {blink || leftEyeClosed || mood === 'happy' ? (
            <line x1="-18" y1="0" x2="18" y2="0" stroke={color} strokeWidth="14" strokeLinecap="round" />
          ) : (
            <circle r="16" fill={color} />
          )}
        </g>
        <g transform="translate(175, 60)">
          {blink || rightEyeClosed || mood === 'happy' ? (
            <line x1="-18" y1="0" x2="18" y2="0" stroke={color} strokeWidth="14" strokeLinecap="round" />
          ) : (
            <circle r="16" fill={color} />
          )}
        </g>

        {/* Boca */}
        <g transform="translate(120, 100)">
          {isTalking ? (
            <ellipse ry={mouthOpen ? 20 : 4} rx="25" fill="none" stroke={color} strokeWidth="10" />
          ) : mood === 'happy' ? (
            <path d="M-30,0 Q0,25 30,0" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
          ) : mood === 'angry' ? (
            <path d="M-20,10 Q0,0 20,10" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
          ) : (
            <line x1="-15" y1="0" x2="15" y2="0" stroke={color} strokeWidth="10" strokeLinecap="round" />
          )}
        </g>
      </svg>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4 font-mono select-none overflow-hidden" onTouchStart={initAudio} onClick={initAudio}>
      
      {/* AREA DE INTERAÇÃO DO PET */}
      <div 
        className="relative w-full max-w-[480px] aspect-[3/2] border-[16px] border-zinc-900 rounded-[3rem] flex items-center justify-center transition-all duration-700 overflow-hidden"
        style={{ backgroundColor: theme.bg, boxShadow: `0 0 80px ${theme.glow}` }}
        onMouseMove={(e) => e.buttons === 1 && handlePetting()}
        onTouchMove={handlePetting}
      >
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(0,0,0,0.2)_50%,transparent_50%)] bg-[length:100%_6px] z-10"></div>
        
        {/* Zonas Invisíveis de Toque nos Olhos */}
        <div 
          className="absolute left-[15%] top-[20%] w-[30%] h-[40%] z-20 cursor-pointer" 
          onMouseDown={() => handleEyePoke('left')}
          onMouseUp={stopEyePoke}
          onMouseLeave={stopEyePoke}
          onTouchStart={() => handleEyePoke('left')}
          onTouchEnd={stopEyePoke}
        />
        <div 
          className="absolute right-[15%] top-[20%] w-[30%] h-[40%] z-20 cursor-pointer" 
          onMouseDown={() => handleEyePoke('right')}
          onMouseUp={stopEyePoke}
          onMouseLeave={stopEyePoke}
          onTouchStart={() => handleEyePoke('right')}
          onTouchEnd={stopEyePoke}
        />

        <div className={`relative z-0 transition-transform duration-300 ${isTalking ? 'scale-110' : 'scale-100'}`}>
          <PetFace mood={status.mood} isTalking={isTalking} />
        </div>

        {/* Partículas de Coração quando Feliz */}
        {status.mood === 'happy' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-10 left-1/4 animate-ping text-red-500">❤</div>
            <div className="absolute top-20 right-1/4 animate-bounce text-red-500" style={{animationDelay: '1s'}}>❤</div>
          </div>
        )}
      </div>

      {/* PAINEL DE COMANDOS */}
      <div className="mt-12 w-full max-w-[480px] flex gap-3">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleInteraction(input)}
          className="flex-1 bg-zinc-900 border-2 border-zinc-800 text-cyan-400 p-4 rounded-2xl focus:outline-none focus:border-cyan-700 transition-all"
          placeholder="Digite algo..."
        />
        
        <button 
          onClick={startListening}
          className={`p-4 rounded-2xl transition-all active:scale-95 ${isListening ? 'bg-white scale-110' : 'bg-zinc-800'}`}
          title="Falar"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isListening ? "black" : "#00ffff"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
          </svg>
        </button>

        <button 
          onClick={() => handleInteraction(input)}
          disabled={loading || !input.trim()}
          className="bg-cyan-600 text-black px-6 rounded-2xl font-black disabled:opacity-20 active:scale-95 transition-all"
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default App;
