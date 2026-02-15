import { Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <div className="flex flex-col items-center text-center mb-10 mt-12">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-8 h-8 text-indigo-500" />
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">FocusFlow</h1>
      </div>
      <h2 className="text-xl text-slate-700 font-medium mb-2">
        Your AI reading companion for better focus and comprehension
      </h2>
      <p className="text-sm text-slate-500">
        Designed for neurodivergent readers with ADHD, learning disabilities, or executive function challenges
      </p>
    </div>
  );
}