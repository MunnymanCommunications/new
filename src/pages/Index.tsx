import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { PreviewPanel } from '@/components/preview/PreviewPanel';
import { FileTree } from '@/components/editor/FileTree';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { VisualEditor } from '@/components/editor/VisualEditor';
import { useEditorStore } from '@/stores/editor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Code, FolderTree } from 'lucide-react';

export function IndexPage() {
  const { isVisualEditMode, fileTreeOpen } = useEditorStore();
  const [activeTab, setActiveTab] = React.useState('chat');

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel: Chat + File Tree + Code Editor */}
        <Panel defaultSize={35} minSize={25} maxSize={50}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-2 mt-1 mb-0 h-9 bg-secondary/30">
              <TabsTrigger value="chat" className="gap-1.5 text-xs">
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="code" className="gap-1.5 text-xs">
                <Code className="w-3.5 h-3.5" />
                Code
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-1.5 text-xs">
                <FolderTree className="w-3.5 h-3.5" />
                Files
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 mt-0 overflow-hidden">
              <ChatPanel />
            </TabsContent>

            <TabsContent value="code" className="flex-1 mt-0 overflow-hidden">
              <div className="flex h-full">
                <div className="w-48 border-r border-border overflow-y-auto">
                  <FileTree />
                </div>
                <div className="flex-1">
                  <CodeEditor />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files" className="flex-1 mt-0 overflow-hidden">
              <FileTree />
            </TabsContent>
          </Tabs>
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle className="w-1.5 bg-border/50 hover:bg-primary/30 transition-colors cursor-col-resize" />

        {/* Right Panel: Preview + Visual Editor */}
        <Panel defaultSize={65} minSize={40}>
          <div className="flex h-full">
            <div className="flex-1">
              <PreviewPanel />
            </div>
            {isVisualEditMode && <VisualEditor />}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
