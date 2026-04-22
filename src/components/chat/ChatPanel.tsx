import React, { useRef, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChatStore } from '@/stores/chat';
import { useProjectStore } from '@/stores/project';

export function ChatPanel() {
  const { messages, sendMessage, clearMessages, isStreaming, contextMeta, activeTools } = useChatStore();
  const { currentProjectId, files } = useProjectStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSend = (content: string) => {
    if (!currentProjectId) return;
    sendMessage(content, currentProjectId, files);
  };

  const utilization = contextMeta?.tokenBudget?.utilizationPercent;
  const wasOverBudget = contextMeta?.tokenBudget?.overBudget;
  const wasTruncated = contextMeta?.contextWasTruncated;

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <TooltipProvider>
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Chat</h2>
            <span className="text-xs text-muted-foreground">
              {messages.length} messages
            </span>
            {contextMeta && utilization !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                    wasOverBudget ? 'bg-destructive/20 text-destructive' :
                    utilization > 80 ? 'bg-yellow-500/20 text-yellow-500' :
                    'bg-green-500/20 text-green-500'
                  }`}>
                    {wasOverBudget ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : (
                      <Info className="w-3 h-3" />
                    )}
                    {utilization}%
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="text-xs space-y-1">
                    <div>Context window: {utilization}% used</div>
                    {contextMeta.tokenBudget && (
                      <div>~{contextMeta.tokenBudget.totalInputTokens.toLocaleString()} / {contextMeta.tokenBudget.inputBudget.toLocaleString()} tokens</div>
                    )}
                    {wasTruncated && (
                      <div className="text-yellow-400">
                        {contextMeta.filesDropped?.length ? `${contextMeta.filesDropped.length} file(s) excluded` : ''}
                        {contextMeta.messagesDropped ? ` • ${contextMeta.messagesDropped} message(s) trimmed` : ''}
                      </div>
                    )}
                    {wasOverBudget && (
                      <div className="text-destructive">Over budget — response quality may be affected</div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={clearMessages}
                  disabled={isStreaming}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear chat</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isStreaming}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Regenerate last response</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>

      {/* Active tool executions */}
      {activeTools.length > 0 && (
        <div className="px-4 py-2 border-b border-border space-y-1">
          {activeTools.map((tool) => (
            <div key={tool.id} className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${
                tool.status === 'running' ? 'bg-blue-400 animate-pulse' :
                tool.status === 'retrying' ? 'bg-yellow-400 animate-pulse' :
                tool.status === 'success' ? 'bg-green-400' :
                'bg-red-400'
              }`} />
              <span className="text-muted-foreground truncate flex-1">
                {tool.tool === 'sql' ? 'SQL' : 'File'}: {tool.label}
              </span>
              {tool.status === 'retrying' && (
                <span className="text-yellow-500">retry #{tool.attempt}</span>
              )}
              {tool.status === 'error' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>{tool.error}</TooltipContent>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="py-2">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3 px-4 py-4">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-white">AI</span>
              </div>
              <div className="flex items-center gap-1 py-3">
                <span className="thinking-dot w-2 h-2 rounded-full bg-primary" />
                <span className="thinking-dot w-2 h-2 rounded-full bg-primary" />
                <span className="thinking-dot w-2 h-2 rounded-full bg-primary" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isStreaming || !currentProjectId} />
    </div>
  );
}
