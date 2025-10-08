# Customer Chat Module

This module contains all customer-facing chat functionality, organized following industry standards
for maintainability and scalability.

## Structure

```
src/app/customer/
├── components/           # React components
│   ├── customer-chat-bubble.tsx
│   ├── header.tsx
│   ├── chat-settings.tsx
│   ├── chat-intro.tsx
│   ├── input-box.tsx
│   └── animated-background.tsx
├── constants/           # Configuration and constants
│   ├── pos-system.ts    # POS system configuration
│   └── suggestions.ts   # UI suggestions and quick actions
├── hooks/              # Custom React hooks
│   └── use-chat.ts     # Main chat functionality hook
├── services/           # Business logic services
│   └── chat-service.ts # Chat API service
├── types/              # TypeScript type definitions
│   └── customer.types.ts
├── utils/              # Utility functions
│   └── message-utils.ts
├── page.tsx            # Main page component
├── index.ts            # Module exports
└── README.md           # This file
```

## Key Features

### Components

- **CustomerChatBubble**: Displays individual chat messages with formatting and suggestions
- **Header**: Top navigation with loading states and settings
- **ChatSettings**: Sidebar with conversation management and quick actions
- **ChatIntro**: Welcome screen with feature highlights and sample questions
- **InputBox**: Message input with suggestions and quick actions
- **AnimatedBackground**: Decorative background animation

### Services

- **ChatService**: Handles all chat-related API calls and state management
- Singleton pattern for consistent state across components

### Hooks

- **useChat**: Main hook that provides all chat functionality
- Encapsulates state management, API calls, and user interactions
- Provides clean interface for components

### Utils

- **Message Utils**: Functions for message formatting, validation, and creation
- Consistent message handling across the application

### Constants

- **POS System**: Configuration for different POS systems and prompts
- **Suggestions**: UI suggestions, quick actions, and sample questions

## Usage

```tsx
import { useChat, CustomerChatBubble, Header } from './customer';

function MyChatPage() {
  const {
    messages,
    sendMessage,
    isLoading,
    // ... other chat state and actions
  } = useChat();

  return (
    <div>
      <Header isLoading={isLoading} onSettingsClick={() => {}} />
      {messages.map(message => (
        <CustomerChatBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
```

## Benefits of This Structure

1. **Separation of Concerns**: Each layer has a specific responsibility
2. **Reusability**: Components and utilities can be easily reused
3. **Testability**: Services and utilities can be unit tested independently
4. **Maintainability**: Clear organization makes code easier to understand and modify
5. **Scalability**: Easy to add new features without affecting existing code
6. **Type Safety**: Comprehensive TypeScript types prevent runtime errors
