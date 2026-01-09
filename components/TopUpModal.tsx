
import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { translations, Language } from '../translations';

interface TopUpModalProps {
  user: User;
  onClose: () => void;
  lang: Language;
}

const PLANS = [
  { credits: 100, price: '199 dhs', id: 'basic' },
  { credits: 500, price: '499 dhs', id: 'pro' },
  { credits: 1000, price: '899 dhs', id: 'enterprise' },
];

const TopUpModal: React.FC<TopUpModalProps> = ({ user, onClose, lang }) => {
  const t = translations[lang];
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(PLANS[0]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError(lang === 'fr' ? 'Veuillez télécharger un reçu.' : 'Please upload a screenshot of your transfer.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const storagePath = `payment_proofs/${user.uid}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, 'payment_requests'), {
        uid: user.uid,
        userEmail: user.email,
        userName: user.displayName || 'Unknown',
        proofUrl: downloadUrl,
        proofPath: storagePath,
        status: 'pending',
        amount: `${selectedPlan.credits} Credits (${selectedPlan.price})`,
        creditsRequested: selectedPlan.credits,
        createdAt: new Date().toISOString()
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2500);

    } catch (err: any) {
      console.error("Payment request failed:", err);
      setError("Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white relative">
        
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <i className="fas fa-times text-lg"></i>
        </button>

        <div className="p-8 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
               <i className="fas fa-coins text-yellow-400"></i>
            </div>
            <h2 className="text-xl font-bold">{t.topUp}</h2>
          </div>

          {!success ? (
            <>
              <div className="mb-6">
                <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">{t.selectPackage}</div>
                <div className="grid grid-cols-1 gap-2">
                  {PLANS.map((plan) => (
                    <div 
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`
                        relative flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all
                        ${selectedPlan.id === plan.id 
                          ? 'bg-gray-800 border-yellow-500 shadow-sm shadow-yellow-500/10' 
                          : 'bg-transparent border-gray-700 hover:bg-gray-800 hover:border-gray-600'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                         <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedPlan.id === plan.id ? 'border-yellow-500' : 'border-gray-500'}`}>
                            {selectedPlan.id === plan.id && <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>}
                         </div>
                         <span className="font-bold text-sm">{plan.credits} {lang === 'fr' ? 'Crédits' : 'Credits'}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-300">{plan.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6 relative group">
                <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-4">{t.bankTransfer}</div>
                <div className="flex items-center justify-center py-4">
                  <span className="text-sm font-medium text-gray-400 italic">{t.comingSoon}</span>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                {t.transferInstruction.replace('{price}', selectedPlan.price)}
              </p>

              <div className="mb-6">
                <label className={`
                  flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed transition-all cursor-pointer
                  ${file ? 'border-green-500/50 bg-green-500/10' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800'}
                `}>
                  {file ? (
                    <div className="text-center">
                      <i className="fas fa-check-circle text-2xl text-green-400 mb-2"></i>
                      <p className="text-xs text-green-200 font-medium">{file.name}</p>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      <i className="fas fa-cloud-upload-alt text-2xl mb-2"></i>
                      <p className="text-xs font-medium">{t.uploadReceipt}</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              </div>

              {error && <div className="mb-4 p-3 bg-red-900/30 border border-red-900/50 rounded-lg text-red-200 text-xs text-center">{error}</div>}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-white text-gray-900 font-bold py-3.5 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : t.submitRequest}
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 animate-in zoom-in duration-300">
               <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-500/20">
                 <i className="fas fa-check text-white text-2xl"></i>
               </div>
               <h3 className="text-lg font-bold text-white mb-2">{t.requestSent}</h3>
               <p className="text-gray-400 text-xs text-center max-w-[240px]">
                 {t.requestReceived.replace('{credits}', selectedPlan.credits.toString())}
               </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopUpModal;
