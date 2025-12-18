import React, { useState, useEffect, useRef } from 'react';

// A chave será lida da Vercel (VITE_GEMINI_API_KEY)
const getApiKey = () => {
try { return import.meta.env.VITE_GEMINI_API_KEY || ""; } catch (e) { return ""; }
};
const apiKey = getApiKey();

const App = () => {
const [input, setInput] = useState('');
const [status, setStatus] = useState({ text: "", mood: 'idle' });
const [loading, setLoading] = useState(false);
const [isListening, setIsListening] = useState(false);
const [isTalking, setIsTalking] = useState(false);

const [leftEyeClosed, setLeftEyeClosed] = useState(false);
const [rightEyeClosed, setRightEyeClosed] = useState(false);
const [pettingScore, setPettingScore] = useState(0);
const [eyePokeTimer, setEyePokeTimer] = useState(null);

const audioContext = useRef(null);
const talkInterval = useRef(null);

const initAudio = async () => {
if (!audioContext.current) {
audioContext.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
}
if (audioContext.current.state === 'suspended') await audioContext.current.resume();
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
setIsTalking(false);
}
};

const handleInteraction = async (text, customPrompt = null) => {
if (!apiKey) return;
if ((!text.trim() && !customPrompt) || loading) return;
await initAudio();
setLoading(true);
if (!customPrompt) setInput('');

try {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Age como um pet virtual. Responde curto e fofo. Retorna APENAS JSON: {"text": "frase", "mood": "happy|sad|angry|surprised"}. Contexto: ${customPrompt || text}` }] }]
    })
  });

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { text: raw, mood: 'happy' };
  
  setStatus(parsed);

  const ttsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Diz com fofura: ${parsed.text}` }] }],
      generationConfig: { 
        responseModalities: ["AUDIO"], 
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } 
      }
    })
  });
  const ttsData = await ttsRes.json();
  const pcmData = ttsData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (pcmData) playPCM(pcmData);

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
recognition.lang = 'pt-PT';
recognition.onstart = () => setIsListening(true);
recognition.onend = () => setIsListening(false);
recognition.onresult = (e) => handleInteraction(e.results[0][0].transcript);
recognition.start();
};

return (
<div className="flex flex-col items-center justify-center min-h-screen bg-black p-4 font-mono select-none overflow-hidden" onClick={initAudio}>
<div
className="relative w-full max-w-[480px] aspect-[3/2] border-[16px] border-zinc-900 rounded-[3rem] flex items-center justify-center transition-all duration-700 overflow-hidden"
style={{ backgroundColor: theme.bg, boxShadow: 0 0 80px ${theme.glow} }}
>
<div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(0,0,0,0.2)_50%,transparent_50%)] bg-[length:100%_6px] z-10"></div>

    {/* Face do Pet Simplificada */}
    <div className={`relative z-0 transition-transform duration-300 ${isTalking ? 'scale-110' : 'scale-100'}`}>
       <svg width="240" height="120" viewBox="0 0 240 120">
          <circle cx="65" cy="60" r="16" fill={theme.text} />
          <circle cx="175" cy="60" r="16" fill={theme.text} />
          <path d={isTalking ? "M100,100 Q120,120 140,100" : "M100,100 Q120,110 140,100"} fill="none" stroke={theme.text} strokeWidth="8" strokeLinecap="round" />
       </svg>
    </div>
  </div>

  <div className="mt-8 w-full max-w-[480px] flex gap-2">
    <input 
      type="text" 
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && handleInteraction(input)}
      className="flex-1 bg-zinc-900 border-2 border-zinc-800 text-cyan-400 p-4 rounded-xl focus:outline-none focus:border-cyan-600"
      placeholder="Diz olá..."
    />
    <button onClick={startListening} className={`p-4 rounded-xl ${isListening ? 'bg-red-500' : 'bg-zinc-800'}`}>🎤</button>
    <button onClick={() => handleInteraction(input)} className="bg-cyan-600 text-black px-6 rounded-xl font-bold">OK</button>
  </div>
</div>


);
};

export default App;
