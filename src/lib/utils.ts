import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getYouTubeEmbedUrl(url: string) {
  if (!url) return '';
  
  // Already an embed URL
  if (url.includes('youtube.com/embed/')) return url;
  
  // Handle standard watch URL
  const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/);
  if (watchMatch && watchMatch[1]) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`;
  }
  
  return url;
}

export function getEmbedUrl(url: string) {
  if (!url) return '';

  const trimmedUrl = url.trim();

  // Handle raw HTML code (if the user provides <html>...</html>)
  if (trimmedUrl.toLowerCase().startsWith('<!doctype html>') || trimmedUrl.toLowerCase().startsWith('<html')) {
    return `data:text/html;charset=utf-8,${encodeURIComponent(trimmedUrl)}`;
  }

  // Handle YouTube
  if (trimmedUrl.includes('youtube.com') || trimmedUrl.includes('youtu.be')) {
    return getYouTubeEmbedUrl(trimmedUrl);
  }

  // Handle Google Drive
  if (trimmedUrl.includes('drive.google.com')) {
    let fileId = '';
    
    if (trimmedUrl.includes('/file/d/')) {
      const match = trimmedUrl.match(/\/file\/d\/([^/&?]+)/);
      if (match) fileId = match[1];
    } else if (trimmedUrl.includes('id=')) {
      const match = trimmedUrl.match(/id=([^/&?]+)/);
      if (match) fileId = match[1];
    }

    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
  }

  // Handle Google Docs/Sheets/Slides
  if (trimmedUrl.includes('docs.google.com')) {
    if (trimmedUrl.includes('/pubhtml') || trimmedUrl.includes('/embed') || trimmedUrl.includes('/preview')) {
      return trimmedUrl;
    }
    // Try to append /embed or replace /edit with /embed
    if (trimmedUrl.includes('/edit')) {
      return trimmedUrl.replace(/\/edit.*$/, '/embed');
    }
    if (trimmedUrl.includes('/view')) {
      return trimmedUrl.replace(/\/view.*$/, '/preview');
    }
  }

  // Handle common document types using Google Docs Viewer as a fallback for embedding
  const isDoc = trimmedUrl.match(/\.(pdf|doc|docx|ppt|pptx|xls|xlsx)$/i);
  if (isDoc && !trimmedUrl.includes('docs.google.com') && !trimmedUrl.includes('drive.google.com')) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(trimmedUrl)}&embedded=true`;
  }

  return trimmedUrl;
}

export function normalizeEvaluation(evaluation: any[]) {
  if (!Array.isArray(evaluation)) return [];
  
  return evaluation.map((q: any) => {
    if (typeof q === 'string') {
      return {
        id: Math.random().toString(36).substring(2, 9),
        question: q,
        options: [
          { id: 'a', text: 'Option A' },
          { id: 'b', text: 'Option B' }
        ],
        correctId: 'a'
      };
    }
    
    const normalizedOptions = (Array.isArray(q.options) ? q.options : []).map((opt: any, idx: number) => {
      if (typeof opt === 'string') {
        return {
          id: String.fromCharCode(97 + idx), // a, b, c, d
          text: opt
        };
      }
      return {
        id: opt?.id || String.fromCharCode(97 + idx),
        text: opt?.text || ''
      };
    });
    
    return {
      ...q,
      id: q.id || Math.random().toString(36).substring(2, 9),
      question: q.question || '',
      options: normalizedOptions,
      correctId: q.correctId || (normalizedOptions[0]?.id || 'a')
    };
  });
}
