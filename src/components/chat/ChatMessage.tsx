import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, MoreHorizontal, FileCode, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn(
        'group flex gap-3 px-4 py-4 animate-slide-in',
        isUser && 'flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarFallback
          className={cn(
            'text-xs font-medium',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
          )}
        >
          {isUser ? 'U' : 'AI'}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div className={cn('flex-1 space-y-2', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 max-w-[85%] text-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-secondary/50 border border-border/50 rounded-tl-sm'
          )}
        >
          {isAssistant ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');

                    if (match) {
                      return (
                        <div className="relative group/code my-3">
                          <div className="flex items-center justify-between px-4 py-2 rounded-t-lg bg-secondary/80 border border-border/50 text-xs text-muted-foreground">
                            <span>{match[1]}</span>
                            <CopyButton text={codeString} />
                          </div>
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{
                              margin: 0,
                              borderTopLeftRadius: 0,
                              borderTopRightRadius: 0,
                              fontSize: '0.8125rem',
                            }}
                          >
                            {codeString}
                          </SyntaxHighlighter>
                        </div>
                      );
                    }

                    return (
                      <code
                        className="bg-secondary/80 px-1.5 py-0.5 rounded text-xs font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-flex gap-1 ml-1">
                  <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-primary" />
                </span>
              )}
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Files Changed */}
        {message.filesChanged && message.filesChanged.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-w-[85%]">
            {message.filesChanged.map((file) => (
              <Badge
                key={file.path}
                variant="outline"
                className="gap-1 text-xs font-mono cursor-pointer hover:bg-accent"
              >
                <FileCode className="w-3 h-3" />
                {file.path}
                <span
                  className={cn(
                    'text-[10px]',
                    file.action === 'create' && 'text-green-500',
                    file.action === 'modify' && 'text-yellow-500',
                    file.action === 'delete' && 'text-red-500'
                  )}
                >
                  {file.action === 'create' ? '+' : file.action === 'modify' ? '~' : '-'}
                </span>
              </Badge>
            ))}
          </div>
        )}

        {/* Meta info */}
        <TooltipProvider>
          <div
            className={cn(
              'flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity',
              isUser && 'flex-row-reverse'
            )}
          >
            {message.creditCost !== undefined && (
              <Tooltip>
                <TooltipTrigger>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Zap className="w-3 h-3" />
                    {message.creditCost}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{message.creditCost} credits used</TooltipContent>
              </Tooltip>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 hover:opacity-100">
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
