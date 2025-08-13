export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          encrypted_value: string
          id: string
          key_name: string
          mcp_server_id: string | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          encrypted_value: string
          id?: string
          key_name: string
          mcp_server_id?: string | null
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          encrypted_value?: string
          id?: string
          key_name?: string
          mcp_server_id?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_mcp_server_id_fkey"
            columns: ["mcp_server_id"]
            referencedRelation: "mcp_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          system_prompt: string | null
          tenant_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          system_prompt?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          system_prompt?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          embedding_id: string | null
          id: string
          metadata: Json
          tenant_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          embedding_id?: string | null
          id?: string
          metadata?: Json
          tenant_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          embedding_id?: string | null
          id?: string
          metadata?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_tenant_id_fkey"
            columns: ["tenant_id"]
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      documents: {
        Row: {
          chunk_count: number
          content: string
          content_type: string
          created_at: string
          embedding_id: string | null
          id: string
          metadata: Json
          source_url: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          chunk_count?: number
          content: string
          content_type?: string
          created_at?: string
          embedding_id?: string | null
          id?: string
          metadata?: Json
          source_url?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          chunk_count?: number
          content?: string
          content_type?: string
          created_at?: string
          embedding_id?: string | null
          id?: string
          metadata?: Json
          source_url?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      mcp_servers: {
        Row: {
          capabilities: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          server_args: string[] | null
          server_command: string | null
          server_env: Json
          server_url: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          capabilities?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          server_args?: string[] | null
          server_command?: string | null
          server_env?: Json
          server_url?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          capabilities?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          server_args?: string[] | null
          server_command?: string | null
          server_env?: Json
          server_url?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_servers_tenant_id_fkey"
            columns: ["tenant_id"]
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          retrieved_documents: Json | null
          role: string
          token_count: number | null
          tool_calls: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          retrieved_documents?: Json | null
          role: string
          token_count?: number | null
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          retrieved_documents?: Json | null
          role?: string
          token_count?: number | null
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          }
        ]
      }
      tenant_configurations: {
        Row: {
          created_at: string
          embedding_api_key: string | null
          embedding_model: string
          id: string
          llm_api_key: string
          llm_model: string
          llm_provider: string
          max_context_length: number
          system_prompt: string
          temperature: number
          tenant_id: string
          updated_at: string
          vector_db_config: Json
        }
        Insert: {
          created_at?: string
          embedding_api_key?: string | null
          embedding_model?: string
          id?: string
          llm_api_key: string
          llm_model?: string
          llm_provider?: string
          max_context_length?: number
          system_prompt?: string
          temperature?: number
          tenant_id: string
          updated_at?: string
          vector_db_config?: Json
        }
        Update: {
          created_at?: string
          embedding_api_key?: string | null
          embedding_model?: string
          id?: string
          llm_api_key?: string
          llm_model?: string
          llm_provider?: string
          max_context_length?: number
          system_prompt?: string
          temperature?: number
          tenant_id?: string
          updated_at?: string
          vector_db_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tenant_configurations_tenant_id_fkey"
            columns: ["tenant_id"]
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          conversation_id: string | null
          cost_cents: number
          created_at: string
          event_type: string
          id: string
          metadata: Json
          tenant_id: string
          tokens_used: number
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          cost_cents?: number
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          tenant_id: string
          tokens_used?: number
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          cost_cents?: number
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          tenant_id?: string
          tokens_used?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_logs_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          role?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}