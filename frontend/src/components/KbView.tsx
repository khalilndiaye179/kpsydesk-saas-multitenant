import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface KBArticle {
  id: string;
  title: string;
  category: string;
  author: string;
  content: string;
  date?: string;
}

export const KbView: React.FC = () => {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modals
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [readingArticle, setReadingArticle] = useState<KBArticle | null>(null);

  // Form Fields
  const [formFields, setFormFields] = useState({
    title: '',
    category: 'Matériel',
    author: 'Admin IT',
    content: ''
  });

  const fetchArticles = async () => {
    try {
      const res = await api.get('/kb');
      setArticles(res.data || []);
    } catch (err) {
      console.warn('API error in KbView.', err);
      setArticles([]);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/kb', { ...formFields, performedBy: 'admin' });
      setIsWriteOpen(false);
      fetchArticles();
    } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur d'enregistrement de l'article : " + msg); }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Supprimer cet article ?")) {
      try {
        await api.delete(`/kb/${id}?performedBy=admin`);
        fetchArticles();
      } catch (err: any) { const msg = err.response?.data?.message || err.message || "Erreur inconnue"; alert("Erreur de suppression : " + msg); }
    }
  };

  const categories = Array.from(new Set(articles.map(a => a.category)));

  const filtered = articles.filter(a => {
    const term = search.toLowerCase();
    const matchesSearch = a.title.toLowerCase().includes(term) || a.content.toLowerCase().includes(term);
    const matchesCategory = filterCategory === '' || a.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Base de Connaissances</h1>
          <p style={{ color: 'var(--text-muted)' }}>Procédures techniques, foires aux questions et tutoriels</p>
        </div>
        <button className="btn-primary" onClick={() => {
          setFormFields({
            title: '',
            category: 'Matériel',
            author: 'Admin IT',
            content: ''
          });
          setIsWriteOpen(true);
        }}>
          <i className="ph ph-plus"></i> Rédiger un Article
        </button>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.25rem 0.75rem', width: '300px' }}>
          <i className="ph ph-magnifying-glass" style={{ color: 'var(--text-muted)' }}></i>
          <input 
            type="text" 
            placeholder="Rechercher dans le wiki..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%' }}
          />
        </div>
        <select 
          value={filterCategory} 
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.5rem', color: 'white' }}
        >
          <option value="">Toutes les catégories</option>
          {categories.map((cat, idx) => (
            <option key={idx} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: 'span 3', textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
            Aucun article dans cette rubrique.
          </div>
        ) : (
          filtered.map(a => (
            <div 
              key={a.id} 
              className="stat-card" 
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '220px', justifyContent: 'space-between' }}
              onClick={() => setReadingArticle(a)}
            >
              <div>
                <span className="status-badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent-primary)', marginBottom: '10px' }}>
                  {a.category}
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.4 }}>
                  {a.title}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {a.content}
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '10px' }}>
                <span>Par : {a.author}</span>
                <button 
                  className="btn-text" 
                  style={{ color: 'var(--danger)', border: 'none', background: 'none', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(a.id);
                  }}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {readingArticle && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '650px', maxWidth: '95%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <span className="status-badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent-primary)', marginBottom: '5px' }}>{readingArticle.category}</span>
                <h2 style={{ fontSize: '1.5rem', color: 'white', marginTop: '5px' }}>{readingArticle.title}</h2>
              </div>
              <button className="btn-icon" onClick={() => setReadingArticle(null)}>&times;</button>
            </div>
            <div style={{ maxHeight: '350px', overflowY: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px', whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#e2e8f0', marginBottom: '20px' }}>
              {readingArticle.content}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span>Auteur : <strong>{readingArticle.author}</strong></span>
              <button className="btn-primary" onClick={() => setReadingArticle(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {isWriteOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="module-container" style={{ width: '600px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Rédiger un article wiki</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Titre de l'article</label>
                  <input 
                    type="text" 
                    value={formFields.title} 
                    onChange={e => setFormFields({...formFields, title: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                    placeholder="Ex: Comment configurer l'imprimante HP"
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Catégorie</label>
                    <input 
                      type="text" 
                      value={formFields.category} 
                      onChange={e => setFormFields({...formFields, category: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      placeholder="Ex: Réseau, Sécurité, Matériel..."
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Auteur</label>
                    <input 
                      type="text" 
                      value={formFields.author} 
                      onChange={e => setFormFields({...formFields, author: e.target.value})} 
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px' }}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Contenu de la procédure</label>
                  <textarea 
                    value={formFields.content} 
                    onChange={e => setFormFields({...formFields, content: e.target.value})} 
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '6px', height: '180px' }}
                    placeholder="Rédigez ici les étapes détaillées..."
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-icon" onClick={() => setIsWriteOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Publier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


