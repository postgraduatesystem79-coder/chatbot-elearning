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
    // 1. Handle case where question is just a string
    if (typeof q === 'string') {
      return {
        id: Math.random().toString(36).substring(2, 9),
        question: q,
        options: [
          { id: 'a', text: 'صواب' },
          { id: 'b', text: 'خطأ' }
        ],
        correctId: 'a',
        type: 'true_false'
      };
    }
    
    const type = q.type || (q.options?.length === 2 ? 'true_false' : 'mcq');
    
    // 2. Handle true_false normalization
    if (type === 'true_false') {
      const options = [
        { id: 'a', text: 'صواب' },
        { id: 'b', text: 'خطأ' }
      ];
      
      let correctId = q.correctId;
      // If correctAnswer is present, it takes precedence for T/F
      if (q.correctAnswer !== undefined) {
        correctId = q.correctAnswer === 'true' ? 'a' : 'b';
      }
      
      return {
        ...q,
        id: q.id || Math.random().toString(36).substring(2, 9),
        question: q.question || '',
        options,
        correctId: correctId || 'a',
        type: 'true_false'
      };
    }

    // 3. Normalize MCQ / other types
    let rawOptions = Array.isArray(q.options) ? q.options : [];
    
    // If it's an MCQ but has no options, provide defaults
    if (rawOptions.length === 0) {
       rawOptions = [
         { id: 'a', text: 'الخيار 1' }, 
         { id: 'b', text: 'الخيار 2' }, 
         { id: 'c', text: 'الخيار 3' }, 
         { id: 'd', text: 'الخيار 4' }
       ];
    }

    const normalizedOptions = rawOptions.map((opt: any, idx: number) => {
      if (typeof opt === 'string') {
        const id = String.fromCharCode(97 + idx); // a, b, c, d
        return { id, text: opt };
      }
      let text = opt?.text || '';
      // Map common variants to standard labels
      const lowerText = text.trim().toLowerCase();
      if (['صح', 'صحيح', 'true', 'yes', 'نعم'].includes(lowerText)) text = 'صواب';
      if (['خطأ', 'خطا', 'خاطئ', 'false', 'no', 'لا'].includes(lowerText)) text = 'خطأ';
      
      return {
        id: opt?.id || String.fromCharCode(97 + idx),
        text
      };
    });

    return {
      ...q,
      id: q.id || Math.random().toString(36).substring(2, 9),
      question: q.question || '',
      options: normalizedOptions,
      correctId: q.correctId || (normalizedOptions[0]?.id || 'a'),
      type: type
    };
  });
}
