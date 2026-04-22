import React, { useState, useRef, useEffect } from 'react';
import { Send, Pencil, MessageSquare, Paperclip, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/chat';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { mode, setMode, isStreaming } = useChatStore();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !disabled && !isStreaming) {
      onSend(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <TooltipProvider>
      <div className="border-t border-border bg-background/80 backdrop-blur-sm p-3 space-y-2">
        {/* Mode toggle */}
        <div className="flex items-center gap-2 px-1">
          <div className="inline-flex rounded-lg bg-secondary/50 p-0.5">
            <button
              onClick={() => setMode('build')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all',
                mode === 'build'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Pencil className="w-3 h-3" />
              Build
            </button>
            <button
              onClick={() => setMode('chat')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all',
                mode === 'chat'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MessageSquare className="w-3 h-3" />
              Chat
            </button>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {mode === 'build' ? '1-10 credits' : '1 credit'}
          </Badge>
        </div>

        {/* Input area */}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'build'
                  ? 'Describe what you want to build...'
                  : 'Ask a question about your project...'
              }
              disabled={disabled || isStreaming}
              rows={1}
              className="w-full resize-none rounded-xl border border-input bg-secondary/30 px-4 py-3 pr-20 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={disabled || isStreaming}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attach file</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={disabled || isStreaming}
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Voice input</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || disabled || isStreaming}
            className="h-11 w-11 rounded-xl shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
