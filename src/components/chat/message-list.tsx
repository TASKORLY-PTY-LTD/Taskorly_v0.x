"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDevMode } from "@/providers/dev-mode-provider";
import { Bot, User, FileText } from "lucide-react";
import { useEffect, useRef } from "react";

export function MessageList() {
  const { mockMessages } = useDevMode();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mockMessages]);

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
      <div className="space-y-4">
        {mockMessages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 ${
              message.role === "user" ? "flex-row-reverse space-x-reverse" : ""
            }`}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {message.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : message.role === "assistant" ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  "S"
                )}
              </AvatarFallback>
            </Avatar>

            <div className={`flex-1 max-w-3xl ${
              message.role === "user" ? "text-right" : ""
            }`}>
              <Card className={`p-4 ${
                message.role === "user" 
                  ? "bg-primary text-primary-foreground ml-12" 
                  : "mr-12"
              }`}>
                <div className="space-y-2">
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {/* Source citations for assistant messages */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="space-y-2 border-t pt-2 mt-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Sources:
                      </p>
                      <div className="space-y-1">
                        {message.sources.map((source) => (
                          <div
                            key={source.id}
                            className="flex items-start space-x-2 text-xs bg-muted/50 rounded p-2"
                          >
                            <FileText className="h-3 w-3 mt-0.5 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium truncate">{source.title}</p>
                                <Badge variant="outline" className="text-xs ml-2">
                                  {(source.similarity * 100).toFixed(0)}%
                                </Badge>
                              </div>
                              <p className="text-muted-foreground mt-1 line-clamp-2">
                                {source.content}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
              
              <p className={`text-xs text-muted-foreground mt-1 ${
                message.role === "user" ? "text-right" : ""
              }`}>
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}