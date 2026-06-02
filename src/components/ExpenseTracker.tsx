import React, { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserProfile, Expense } from "../types";
import { Receipt, Plus, Trash2, QrCode, X } from "lucide-react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

interface ExpenseTrackerProps {
  activityId: string;
  currentUser: UserProfile;
  approvedMembers: string[]; // array of UIDs (including host)
  memberNames: Record<string, string>; // uid -> name
  memberUpis: Record<string, string>; // uid -> upiId
}

export default function ExpenseTracker({ activityId, currentUser, approvedMembers, memberNames, memberUpis }: ExpenseTrackerProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [qrPayee, setQrPayee] = useState<{ upiId: string, name: string, amount: number } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "activities", activityId, "expenses"), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
      setExpenses(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
    return () => unsub();
  }, [activityId]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0 || !description.trim()) return;
    setIsAdding(true);
    try {
      await addDoc(collection(db, "activities", activityId, "expenses"), {
        activityId,
        payerId: currentUser.uid,
        payerName: currentUser.fullName,
        amount: Number(amount),
        description: description.trim(),
        createdAt: new Date().toISOString()
      });
      setAmount("");
      setDescription("");
      setShowAddForm(false);
      toast.success("Expense added!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to add expense");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await deleteDoc(doc(db, "activities", activityId, "expenses", expenseId));
      toast.success("Expense deleted");
    } catch (e) {
      toast.error("Failed to delete expense");
    }
  };

  // Split Logic
  const totalCost = expenses.reduce((sum, e) => sum + e.amount, 0);
  const numPeople = approvedMembers.length;
  const fairShare = numPeople > 0 ? totalCost / numPeople : 0;

  // Calculate balances (positive = owed money, negative = owes money)
  const balances: Record<string, number> = {};
  approvedMembers.forEach(uid => { balances[uid] = 0; }); // initialize
  
  expenses.forEach(e => {
    if (balances[e.payerId] !== undefined) {
      balances[e.payerId] += e.amount;
    }
  });

  approvedMembers.forEach(uid => {
    balances[uid] -= fairShare;
  });

  // Calculate who owes whom (greedy approach)
  const debtors = Object.keys(balances).filter(uid => balances[uid] < -0.01).map(uid => ({ uid, amount: -balances[uid] })).sort((a, b) => b.amount - a.amount);
  const creditors = Object.keys(balances).filter(uid => balances[uid] > 0.01).map(uid => ({ uid, amount: balances[uid] })).sort((a, b) => b.amount - a.amount);

  const transactions: { from: string; to: string; amount: number }[] = [];
  
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    
    const amount = Math.min(debtor.amount, creditor.amount);
    
    transactions.push({
      from: debtor.uid,
      to: creditor.uid,
      amount: amount
    });
    
    debtor.amount -= amount;
    creditor.amount -= amount;
    
    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  const myDebts = transactions.filter(t => t.from === currentUser.uid);
  const myCredits = transactions.filter(t => t.to === currentUser.uid);

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="p-6 border-b border-zinc-200 bg-white flex items-center justify-between z-10 sticky top-0">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-black" />
          <span className="text-[10px] font-black text-black uppercase tracking-widest">EXPENSES & SETTLEMENT</span>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="bg-black text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin space-y-8">
        {showAddForm && (
          <form onSubmit={handleAddExpense} className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl mb-6">
            <h4 className="text-[10px] font-black uppercase text-zinc-500 mb-4 tracking-widest">Add New Expense</h4>
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="What was this for? (e.g. Cab fare)"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Amount (₹)"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-black"
                />
              </div>
              <button type="submit" disabled={isAdding} className="w-full bg-black text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50">
                {isAdding ? "Adding..." : "Add Expense"}
              </button>
            </div>
          </form>
        )}

        {totalCost > 0 ? (
          <>
            <div className="bg-zinc-900 text-white p-5 rounded-3xl flex justify-between items-center shadow-lg">
              <div>
                <div className="text-[9px] font-black tracking-widest uppercase text-zinc-400 mb-1">Total Cost</div>
                <div className="text-3xl font-bold">₹{totalCost.toFixed(2)}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-black tracking-widest uppercase text-zinc-400 mb-1">Per Person</div>
                <div className="text-lg font-bold">₹{fairShare.toFixed(2)}</div>
              </div>
            </div>

            {myDebts.length > 0 && (
              <div>
                <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-4">You Owe</h4>
                <div className="space-y-3">
                  {myDebts.map((debt, idx) => {
                    const toName = memberNames[debt.to] || "Unknown User";
                    const upiId = memberUpis[debt.to];
                    return (
                      <div key={idx} className="flex items-center justify-between bg-red-50 border border-red-100 p-4 rounded-2xl">
                        <div>
                          <div className="text-[10px] font-bold text-red-800 uppercase tracking-wide">To {toName}</div>
                          <div className="text-lg font-black text-red-900">₹{debt.amount.toFixed(2)}</div>
                        </div>
                        {upiId ? (
                          <button
                            onClick={() => setQrPayee({ upiId, name: toName, amount: debt.amount })}
                            className="bg-red-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-red-700 transition-colors shadow-sm"
                          >
                            <QrCode className="w-3.5 h-3.5" /> Pay
                          </button>
                        ) : (
                          <span className="text-[8px] text-red-500 font-bold uppercase tracking-wider bg-red-100/50 px-2 py-1 rounded">No UPI ID</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {myCredits.length > 0 && (
              <div>
                <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-4">Owed to You</h4>
                <div className="space-y-3">
                  {myCredits.map((credit, idx) => {
                    const fromName = memberNames[credit.from] || "Unknown User";
                    return (
                      <div key={idx} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                        <div>
                          <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">From {fromName}</div>
                          <div className="text-lg font-black text-emerald-900">₹{credit.amount.toFixed(2)}</div>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest bg-emerald-100 px-3 py-1.5 rounded-lg">Wait for Pay</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-4 border-b border-zinc-100 pb-2">All Expenses</h4>
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div key={expense.id} className="flex justify-between items-center py-2 border-b border-zinc-50 last:border-0 group">
                    <div>
                      <div className="text-sm font-bold text-zinc-800">{expense.description}</div>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Paid by {expense.payerId === currentUser.uid ? "You" : expense.payerName}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-black text-zinc-900">₹{expense.amount.toFixed(2)}</div>
                      {expense.payerId === currentUser.uid && (
                        <button onClick={() => handleDeleteExpense(expense.id)} className="text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-400">
            <Receipt className="w-12 h-12 mb-4 text-zinc-200" />
            <p className="text-xs font-bold uppercase tracking-wider">No expenses yet</p>
            <p className="text-[10px] max-w-[200px] mx-auto mt-2 leading-relaxed">Add a cab fare or meal cost to automatically split it with everyone.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {qrPayee && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <button onClick={() => setQrPayee(null)} className="absolute top-6 right-6 p-2 bg-zinc-100 rounded-full hover:bg-zinc-200 transition-colors">
              <X className="w-5 h-5 text-black" />
            </button>
            <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2">SCAN TO PAY {qrPayee.name}</h3>
            <div className="text-4xl font-black text-black mb-8 tracking-tighter">₹{qrPayee.amount.toFixed(2)}</div>
            
            <div className="bg-white p-4 rounded-3xl shadow-xl border border-zinc-100 mb-6">
              <QRCode value={`upi://pay?pa=${qrPayee.upiId}&pn=${qrPayee.name}&am=${qrPayee.amount.toFixed(2)}&cu=INR`} size={200} />
            </div>
            
            <div className="text-xs font-bold text-zinc-500 bg-zinc-100 px-4 py-2 rounded-xl flex items-center gap-2 border border-zinc-200">
              UPI ID: <span className="text-black select-all">{qrPayee.upiId}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
