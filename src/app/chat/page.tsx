"use client";

import { Card } from "@/components/ui/card";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";

export default function ChatPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Chat</h1>
        <p className="text-muted-foreground">
          Ask questions about your documents and get intelligent responses.
        </p>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <MessageList />
        <ChatInput />
      </Card>
    </div>
  );
}