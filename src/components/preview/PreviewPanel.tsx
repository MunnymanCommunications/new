import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Smartphone,
  Tablet,
  Monitor,
  Maximize2,
  Minimize2,
  RotateCcw,
  MousePointer,
  Terminal,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useEditorStore, type ConsoleLog } from '@/stores/editor';
import { useProjectStore } from '@/stores/project';
import { generatePreviewHTML } from '@/lib/file-system';
import { generateId } from '@/lib/utils';
import type { DeviceType } from '@/types';

export function PreviewPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const {
    device,
    setDevice,
    isVisualEditMode,
    toggleVisualEditMode,
    showConsole,
    toggleConsole,
    consoleLogs,
    addConsoleLog,
    clearConsoleLogs,
  } = useEditorStore();

  const { files } = useProjectStore();

  const deviceWidths: Record<DeviceType, number> = {
    mobile: 375,
    tablet: 768,
    desktop: -1, // full width
  };

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data?.type === 'preview-error') {
        setPreviewError(event.data.error.message);
        addConsoleLog({
          id: generateId(),
          type: 'error',
          message: `Error: ${event.data.error.message} (line ${event.data.error.line})`,
          timestamp: new Date(),
        });
      }
      if (event.data?.type === 'console-log') {
        addConsoleLog({
          id: generateId(),
          type: event.data.level,
          message: event.data.args.join(' '),
          timestamp: new Date(),
        });
      }
    },
    [addConsoleLog]
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const previewHTML = files.length > 0 ? generatePreviewHTML(files) : '';

  const refreshPreview = () => {
    setPreviewError(null);
    setPreviewKey((k) => k + 1);
  };

  const getDeviceStyle = (): React.CSSProperties => {
    if (device === 'desktop') {
      return { width: '100%', height: '100%' };
    }
    return {
      width: deviceWidths[device],
      height: '100%',
      margin: '0 auto',
      border: '1px solid hsl(var(--border))',
      borderRadius: '12px',
      overflow: 'hidden',
    };
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background/50">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium mr-2">Preview</span>
            {previewError && (
              <Badge variant="destructive" className="text-[10px]">
                Error
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Device toggles */}
            <div className="inline-flex rounded-md bg-secondary/50 p-0.5 mr-2">
              {[
                { type: 'mobile' as DeviceType, icon: Smartphone, label: 'Mobile' },
                { type: 'tablet' as DeviceType, icon: Tablet, label: 'Tablet' },
                { type: 'desktop' as DeviceType, icon: Monitor, label: 'Desktop' },
              ].map(({ type, icon: Icon, label }) => (
                <Tooltip key={type}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setDevice(type)}
                      className={cn(
                        'p-1.5 rounded-sm transition-colors',
                        device === type
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              ))}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isVisualEditMode ? 'default' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={toggleVisualEditMode}
                >
                  {isVisualEditMode ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <MousePointer className="w-3.5 h-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isVisualEditMode ? 'Exit Visual Edit' : 'Visual Edit Mode'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showConsole ? 'default' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={toggleConsole}
                >
                  <Terminal className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle Console</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refreshPreview}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh Preview</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in New Window</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-secondary/20 overflow-hidden relative">
          {isVisualEditMode && (
            <div className="absolute inset-0 z-10 pointer-events-none border-2 border-primary/50 rounded-sm">
              <div className="absolute top-2 left-2 pointer-events-auto">
                <Badge className="bg-primary text-primary-foreground text-xs gap-1">
                  <Eye className="w-3 h-3" />
                  Visual Edit Mode
                </Badge>
              </div>
            </div>
          )}

          <div className="h-full p-4" style={device !== 'desktop' ? { display: 'flex' } : {}}>
            <div style={getDeviceStyle()} className="bg-white">
              <iframe
                key={previewKey}
                ref={iframeRef}
                srcDoc={previewHTML}
                title="App Preview"
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </div>

        {/* Console Panel */}
        {showConsole && (
          <div className="h-48 border-t border-border bg-background">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
              <span className="text-xs font-medium">Console</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{consoleLogs.length} logs</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs px-1.5"
                  onClick={clearConsoleLogs}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="overflow-auto h-[calc(100%-32px)] font-mono text-xs">
              {consoleLogs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No console output
                </div>
              ) : (
                consoleLogs.map((log) => (
                  <ConsoleLogItem key={log.id} log={log} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function ConsoleLogItem({ log }: { log: ConsoleLog }) {
  return (
    <div
      className={cn(
        'px-3 py-1 border-b border-border/50 flex items-start gap-2',
        log.type === 'error' && 'bg-red-500/5 text-red-400',
        log.type === 'warn' && 'bg-yellow-500/5 text-yellow-400',
        log.type === 'info' && 'text-blue-400'
      )}
    >
      <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
        {log.timestamp.toLocaleTimeString()}
      </span>
      <span className="break-all">{log.message}</span>
    </div>
  );
}
