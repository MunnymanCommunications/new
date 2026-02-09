// =============================================================================
// ACE Data Persistence - Save/Load projects via Supabase + localStorage fallback
// =============================================================================

import { getSupabase } from '../../lib/supabaseClient';
import type { ACEProject, DigitalTwin } from '../types';

const LOCAL_STORAGE_KEY = 'ace_projects';

// =============================================================================
// Supabase Persistence (for authenticated users)
// =============================================================================

/**
 * Save a project's Digital Twin and Material List to Supabase.
 * Stores as JSON in a dedicated table. PDF page images are NOT saved
 * to Supabase (too large); they're kept in memory during the session.
 */
export async function saveProjectToSupabase(project: ACEProject): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Save project metadata and digital twin (without image data)
    const projectData = {
      id: project.id,
      user_id: user.id,
      name: project.name,
      status: project.status,
      created_at: project.created_at,
      updated_at: new Date().toISOString(),
      page_count: project.pdf_pages.length,
      digital_twin: project.digital_twin ? stripImageData(project.digital_twin) : null,
      material_list: project.material_list,
      clarifications: project.clarifications,
      audit_trail: project.audit_trail.slice(-100), // Keep last 100 entries
    };

    const { error } = await supabase
      .from('ace_projects')
      .upsert(projectData, { onConflict: 'id' });

    if (error) {
      console.error('Failed to save project to Supabase:', error);
      // Fallback to localStorage
      saveProjectToLocalStorage(project);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Supabase save error:', err);
    saveProjectToLocalStorage(project);
    return false;
  }
}

/**
 * Load all projects for the current user from Supabase.
 */
export async function loadProjectsFromSupabase(): Promise<ACEProject[]> {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return loadProjectsFromLocalStorage();

    const { data, error } = await supabase
      .from('ace_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to load projects from Supabase:', error);
      return loadProjectsFromLocalStorage();
    }

    return (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      pdf_pages: [], // Images are not persisted
      digital_twin: row.digital_twin,
      material_list: row.material_list,
      clarifications: row.clarifications || [],
      audit_trail: row.audit_trail || [],
    }));
  } catch (err) {
    console.error('Supabase load error:', err);
    return loadProjectsFromLocalStorage();
  }
}

/**
 * Delete a project from Supabase.
 */
export async function deleteProjectFromSupabase(projectId: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('ace_projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      console.error('Failed to delete project:', error);
      return false;
    }

    removeProjectFromLocalStorage(projectId);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// localStorage Fallback (works without Supabase table)
// =============================================================================

function saveProjectToLocalStorage(project: ACEProject): void {
  try {
    const existing = loadProjectsFromLocalStorage();
    const idx = existing.findIndex(p => p.id === project.id);

    // Don't save image data to localStorage
    const stripped: ACEProject = {
      ...project,
      pdf_pages: project.pdf_pages.map(p => ({
        ...p,
        imageDataUrl: '', // Strip image data for storage
      })),
      audit_trail: project.audit_trail.slice(-50), // Keep last 50
    };

    if (idx >= 0) {
      existing[idx] = stripped;
    } else {
      existing.unshift(stripped);
    }

    // Keep only last 10 projects in localStorage
    const toSave = existing.slice(0, 10);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.error('localStorage save error:', err);
  }
}

function loadProjectsFromLocalStorage(): ACEProject[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function removeProjectFromLocalStorage(projectId: string): void {
  try {
    const existing = loadProjectsFromLocalStorage();
    const filtered = existing.filter(p => p.id !== projectId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

// =============================================================================
// Helpers
// =============================================================================

function stripImageData(twin: DigitalTwin): DigitalTwin {
  // Digital Twin doesn't contain images directly, so just return as-is
  return twin;
}

/**
 * SQL for creating the Supabase table (run once in Supabase SQL editor):
 *
 * CREATE TABLE IF NOT EXISTS ace_projects (
 *   id TEXT PRIMARY KEY,
 *   user_id UUID REFERENCES auth.users(id) NOT NULL,
 *   name TEXT NOT NULL,
 *   status TEXT NOT NULL DEFAULT 'complete',
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   page_count INTEGER DEFAULT 0,
 *   digital_twin JSONB,
 *   material_list JSONB,
 *   clarifications JSONB DEFAULT '[]'::jsonb,
 *   audit_trail JSONB DEFAULT '[]'::jsonb
 * );
 *
 * ALTER TABLE ace_projects ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can manage own projects"
 *   ON ace_projects FOR ALL
 *   USING (auth.uid() = user_id)
 *   WITH CHECK (auth.uid() = user_id);
 */
