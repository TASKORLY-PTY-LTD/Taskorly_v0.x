"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useDevMode } from "@/providers/dev-mode-provider";
import { LangUIMessageBubble } from "@/components/chat/langui-message-bubble";
import { LangUIChatInput } from "@/components/chat/langui-chat-input";
import { useEffect, useRef } from "react";

export default function ChatV2Page() {
  const { mockMessages } = useDevMode();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mockMessages]);

  return (
    <div className="flex-1 flex flex-col space-y-4 p-4 md:p-6 pt-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Chat</h1>
        <p className="text-muted-foreground">
          Enhanced chat experience with LangUI components.
        </p>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded-2xl border shadow-sm min-h-0">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 bg-green-400 rounded-full"></div>
            <h2 className="font-medium text-slate-700">AI Assistant</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-full border">
              {mockMessages.length} messages
            </span>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {mockMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  Start a conversation
                </h3>
                <p className="text-slate-500 max-w-sm">
                  Ask me anything about your documents. I can help you find information, summarize content, and answer questions.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {mockMessages.map((message) => (
                  <LangUIMessageBubble key={message.id} message={message} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Chat Input */}
        <LangUIChatInput />
      </div>
    </div>
  );
}