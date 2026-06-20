import { useState, useRef, useEffect } from "react";
import PatientLayout from "../../components/PatientLayout";
import { chat, getSuggestedQuestions } from "../../api/api";
import {
  Send, Bot, User,
  Loader2, MessageSquare
} from "lucide-react";

export default function Chatbot() {

  // ── STATE ──────────────────────────────────────────────────────
  const [messages, setMessages] = useState([
    {
      role:    "assistant",
      content: "Hello! I'm your AI health assistant powered by Gemini. I can answer questions about your health records, medications, appointments, and general health advice. How can I help you today?",
      time:    new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit"
      })
    }
  ]);

  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);

  // Dynamic suggested questions — starts with defaults
  // gets replaced with patient-specific questions from API
  const [suggested, setSuggested] = useState([
    "What medications am I currently taking?",
    "When is my next appointment?",
    "What does my diagnosis mean?",
    "Are my vitals normal?",
  ]);

  const bottomRef = useRef(null);

  // ── LOAD DYNAMIC SUGGESTED QUESTIONS ON MOUNT ──────────────────
  // Runs once when page loads
  // Calls backend which checks patient's actual data
  // and returns relevant questions
  useEffect(() => {
    const loadSuggested = async () => {
      try {
        const res = await getSuggestedQuestions();
        // Only update if backend returned questions
        if (res.data.questions.length > 0) {
          setSuggested(res.data.questions);
        }
      } catch (err) {
        // If API fails — keep the default questions above
        console.log("Using default suggested questions");
      }
    };
    loadSuggested();
  }, []); // [] = run only once when component loads

  // ── AUTO SCROLL TO BOTTOM ON NEW MESSAGE ───────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── SEND MESSAGE ───────────────────────────────────────────────
  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText) return;

    // Add user message to chat
    const userMsg = {
      role:    "user",
      content: userText,
      time:    new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit"
      })
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Call backend → Gemini with patient context
      const res = await chat({ message: userText });

      const aiMsg = {
        role:    "assistant",
        content: res.data.reply,
        time:    new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit", minute: "2-digit"
        })
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (err) {
      setMessages(prev => [...prev, {
        role:    "assistant",
        content: "I'm sorry, I couldn't process your request right now. Please try again.",
        time:    new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit", minute: "2-digit"
        }),
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <PatientLayout>

      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">AI Health Assistant</h1>
        <p className="text-slate-500 text-sm mt-1">
          Powered by Gemini 2.5 Flash · Ask anything about your health
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6">

        {/* ── CHAT WINDOW ── */}
        <div className="col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[600px]">

          {/* Chat header */}
          <div className="flex items-center gap-3 p-4 border-b border-slate-100">
            <div className="w-9 h-9 bg-gradient-to-br from-sky-500 to-navy-600 rounded-xl flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <p className="text-slate-800 text-sm font-semibold">
                MedCore AI Assistant
              </p>
              <p className="text-green-500 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                Online · Gemini 2.5 Flash
              </p>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  msg.role === "user"
                    ? "bg-navy-900"
                    : "bg-gradient-to-br from-sky-500 to-navy-600"
                }`}>
                  {msg.role === "user"
                    ? <User size={14} className="text-white" />
                    : <Bot  size={14} className="text-white" />
                  }
                </div>

                {/* Message bubble */}
                <div className={`max-w-md flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-navy-900 text-white rounded-tr-none"
                      : msg.error
                        ? "bg-red-50 text-red-600 border border-red-100 rounded-tl-none"
                        : "bg-slate-100 text-slate-800 rounded-tl-none"
                  }`}>
                    {msg.content}
                  </div>
                  <p className="text-slate-400 text-xs mt-1 px-1">
                    {msg.time}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-navy-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                         style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                         style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                         style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Ask about your health..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !loading) sendMessage();
                }}
                disabled={loading}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="w-11 h-11 bg-navy-900 hover:bg-navy-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
              >
                {loading
                  ? <Loader2 size={18} className="animate-spin" />
                  : <Send   size={18} />
                }
              </button>
            </div>
          </div>
        </div>

        {/* ── SIDEBAR ── */}
        <div className="col-span-1 space-y-4">

          {/* Suggested questions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={16} className="text-sky-500" />
              <h3 className="text-sm font-semibold text-slate-700">
                Suggested Questions
              </h3>
            </div>
            <div className="space-y-2">
              {/* NOW USES suggested STATE — dynamic not static */}
              {suggested.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="w-full text-left px-3 py-2.5 text-xs text-slate-600 bg-slate-50 hover:bg-sky-50 hover:text-sky-600 rounded-xl transition-colors border border-slate-100 hover:border-sky-100 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* About card */}
          <div className="bg-gradient-to-br from-navy-900 to-sky-900 rounded-2xl p-5">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wide mb-2">
              About this AI
            </p>
            <p className="text-white/70 text-xs leading-relaxed">
              Your AI health assistant answers based on your personal health records.
              Always consult your doctor before making any medical decisions.
            </p>
          </div>

        </div>
      </div>
    </PatientLayout>
  );
}