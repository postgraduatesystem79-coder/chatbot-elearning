import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { Link } from 'react-router-dom';
import { 
  MessageSquare, 
  ThumbsUp, 
  MessageCircle, 
  Plus, 
  Search,
  User,
  Clock,
  MoreVertical,
  Trash2,
  Flag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export function Forum() {
  const { t, i18n } = useTranslation();
  const { profile, isAdmin } = useAuth();
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewTopicOpen, setIsNewTopicOpen] = useState(false);
  const [newTopic, setNewTopic] = useState({ title: '', content: '' });

  useEffect(() => {
    const forumRef = collection(db, 'forum_topics');
    const q = query(forumRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTopics(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'forum_topics');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.title || !newTopic.content) return;

    try {
      await addDoc(collection(db, 'forum_topics'), {
        ...newTopic,
        authorId: profile.uid,
        authorName: profile.displayName,
        authorRole: profile.role,
        createdAt: serverTimestamp(),
        likes: 0,
        repliesCount: 0
      });
      setNewTopic({ title: '', content: '' });
      setIsNewTopicOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'forum_topics');
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    try {
      await deleteDoc(doc(db, 'forum_topics', topicId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `forum_topics/${topicId}`);
    }
  };

  const displayTopics = topics.length > 0 ? topics : [
    { id: '1', title: 'How to master React Hooks?', content: 'I am struggling with useEffect dependencies. Any tips?', authorName: 'Ahmed Ali', authorRole: 'student', createdAt: new Date(Date.now() - 3600000), likes: 12, repliesCount: 5 },
    { id: '2', title: 'Best resources for UI/UX design', content: 'Looking for some good books or courses on design systems.', authorName: 'Sarah Johnson', authorRole: 'teacher', createdAt: new Date(Date.now() - 86400000), likes: 24, repliesCount: 12 },
    { id: '3', title: 'Python for Data Science roadmap', content: 'What libraries should I learn first? NumPy or Pandas?', authorName: 'Khalid Mansour', authorRole: 'student', createdAt: new Date(Date.now() - 172800000), likes: 8, repliesCount: 3 },
  ];

  const filteredTopics = displayTopics.filter(topic => 
    topic.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    topic.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('forum')}</h2>
          <p className="text-muted-foreground mt-1">{t('forum_subtitle') || 'Discuss, share, and learn with the community.'}</p>
        </div>
        <button 
          onClick={() => setIsNewTopicOpen(true)}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={20} />
          <span>{t('new_topic') || 'New Topic'}</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <input
          type="text"
          placeholder={t('search_forum') || 'Search discussions...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-card border rounded-xl py-3 ps-10 pe-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />
      </div>

      {/* Topics List */}
      <div className="space-y-4">
        {filteredTopics.map((topic, i) => (
          <motion.div
            key={topic.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {topic.authorName?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{topic.authorName}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="capitalize">{t(topic.authorRole)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatDistanceToNow(topic.createdAt instanceof Date ? topic.createdAt : new Date(topic.createdAt?.seconds * 1000 || Date.now()), { 
                          addSuffix: true,
                          locale: i18n.language === 'ar' ? ar : enUS
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                
                <Link to={`/forum/${topic.id}`}>
                  <h3 className="text-xl font-bold group-hover:text-primary transition-colors mb-2">
                    {topic.title}
                  </h3>
                </Link>
                
                <p className="text-muted-foreground line-clamp-2 text-sm mb-4">
                  {topic.content}
                </p>

                <div className="flex items-center gap-6 pt-4 border-t">
                  <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                    <ThumbsUp size={18} />
                    <span>{topic.likes}</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                    <MessageCircle size={18} />
                    <span>{topic.repliesCount}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button className="p-2 text-muted-foreground hover:bg-accent rounded-lg transition-colors">
                  <MoreVertical size={20} />
                </button>
                {(isAdmin || profile?.uid === topic.authorId) && (
                  <button 
                    onClick={() => handleDeleteTopic(topic.id)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    title={t('delete')}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* New Topic Modal */}
      <AnimatePresence>
        {isNewTopicOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-card rounded-2xl border shadow-2xl p-8"
            >
              <h3 className="text-2xl font-bold mb-6">{t('create_new_topic') || 'Create New Topic'}</h3>
              <form onSubmit={handleCreateTopic} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('topic_title') || 'Title'}</label>
                  <input
                    type="text"
                    required
                    value={newTopic.title}
                    onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                    className="w-full bg-background border rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="What do you want to discuss?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('topic_content') || 'Content'}</label>
                  <textarea
                    required
                    rows={6}
                    value={newTopic.content}
                    onChange={(e) => setNewTopic({ ...newTopic, content: e.target.value })}
                    className="w-full bg-background border rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                    placeholder="Describe your topic in detail..."
                  />
                </div>
                <div className="flex gap-4 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setIsNewTopicOpen(false)}
                    className="px-6 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-accent transition-all"
                  >
                    {t('cancel') || 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    {t('post_topic') || 'Post Topic'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
