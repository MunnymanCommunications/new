// Auto-generated Supabase types placeholder
// In production, these would be generated from the database schema

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          description: string;
          user_id: string;
          created_at: string;
          updated_at: string;
          settings: Record<string, unknown>;
        };
        Insert: {
          name: string;
          description?: string;
          user_id: string;
          settings?: Record<string, unknown>;
        };
        Update: {
          name?: string;
          description?: string;
          settings?: Record<string, unknown>;
        };
      };
      project_files: {
        Row: {
          id: string;
          project_id: string;
          path: string;
          content: string;
          language: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          path: string;
          content: string;
          language?: string;
        };
        Update: {
          content?: string;
          language?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          project_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          mode: 'build' | 'chat';
          credit_cost: number;
          created_at: string;
        };
        Insert: {
          project_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          mode: 'build' | 'chat';
          credit_cost?: number;
        };
        Update: {
          content?: string;
        };
      };
    };
  };
}
