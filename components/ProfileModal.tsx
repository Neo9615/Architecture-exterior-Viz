
import React, { useState } from 'react';
import { User, updateProfile, deleteUser } from 'firebase/auth';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { translations, Language } from '../translations';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onSignOut: () => void;
  lang: Language;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose, onSignOut, lang }) => {
  const t = translations[lang];
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(user, { displayName });
      await updateDoc(doc(db, 'users', user.uid), { displayName });
      onClose();
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">{t.profile}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="p-6 bg-white">
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t.fullName}</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm" placeholder="Your Name" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl shadow-lg">
              {loading ? <i className="fas fa-spinner fa-spin"></i> : t.updateProfile}
            </button>
          </form>
          <div className="mt-8 pt-6 border-t border-gray-100 flex gap-3">
             <button onClick={onSignOut} className="flex-1 bg-white border border-gray-200 text-gray-600 font-medium py-2.5 rounded-lg text-xs">{t.signOut}</button>
             <button onClick={() => deleteUser(user)} className="flex-1 bg-red-50 text-red-600 font-medium py-2.5 rounded-lg text-xs">{t.deleteAccount}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ProfileModal;
