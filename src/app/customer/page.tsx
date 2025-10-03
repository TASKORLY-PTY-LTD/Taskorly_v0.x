'use client';

import { CustomerChatBubble } from './components/customer-chat-bubble';
import { Header } from './components/customerHeader/header';
import { ChatSettings } from './components/customerHeader/chat-settings';
import { ChatIntro } from './components/customerIntro/chat-intro';
import { InputBox } from './components/inputBox/input-box';
import { AnimatedBackground } from './components/animated-background';
import { useChat } from './hooks/use-chat';
import { createLoadingMessage } from './utils/message-utils';
import { LOGO_CONFIG } from './constants/logo-config';

export default function CustomerChatPage() {
  const {
    // State
    messages,
    inputValue,
    isLoading,
    isWelcomeVisible,
    conversationId,
    showSidebar,
    screenContext,

    // Actions
    sendMessage,
    setInputValue,
    clearConversation,
    handleSuggestionClick,
    handleQuickAction,
    captureScreen,
    setShowSidebar,

    // Refs
    scrollRef,
    inputRef,
  } = useChat({
    onError: error => {
      console.error('Chat error:', error);
    },
  });

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-900 via-slate-800 to-teal-900 text-white'>
      <AnimatedBackground />

      <div className='relative z-10 h-screen flex flex-col'>
        {/* Header */}
        <Header
          isLoading={isLoading}
          onSettingsClick={() => setShowSidebar(!showSidebar)}
        />

        {/* Chat Intro */}
        <ChatIntro
          isVisible={isWelcomeVisible}
          onSuggestionClick={handleSuggestionClick}
        />

        {/* Main chat area */}
        <div className='flex-1 flex flex-col bg-gradient-to-br from-blue-900 via-slate-800 to-teal-900'>
          {/* Chat messages */}
          <div className='flex-1 flex flex-col'>
            <div className='px-6 py-2 overflow-y-auto'>
              <div className='space-y-3 max-w-4xl mx-auto'>
                {messages.map(message => (
                  <CustomerChatBubble
                    key={message.id}
                    message={message}
                    isStreaming={message.isStreaming || false}
                    useCustomLogo={true}
                    logoSrc={LOGO_CONFIG.main}
                    logoAlt={LOGO_CONFIG.altText.main}
                    variant='fullscreen'
                    onSuggestionClick={suggestion => sendMessage(suggestion)}
                  />
                ))}
                {/* Loading with CustomerChatBubble */}
                {isLoading && (
                  <CustomerChatBubble
                    message={createLoadingMessage()}
                    isStreaming={true}
                    useCustomLogo={true}
                    logoSrc={LOGO_CONFIG.main}
                    logoAlt={LOGO_CONFIG.altText.main}
                    variant='fullscreen'
                  />
                )}
              </div>
            </div>

            {/* Input Box */}
            <InputBox
              inputValue={inputValue}
              setInputValue={setInputValue}
              onSendMessage={sendMessage}
              onSuggestionClick={handleSuggestionClick}
              isLoading={isLoading}
              hasMessages={messages.length > 0}
            />
          </div>

          {/* Chat Settings */}
          <ChatSettings
            isVisible={showSidebar}
            onClose={() => setShowSidebar(false)}
            messageCount={messages.length}
            conversationId={conversationId}
            onNewConversation={clearConversation}
            onQuickAction={handleQuickAction}
          />
        </div>
      </div>
    </div>
  );
}
