import { Link } from 'react-router-dom';
import SharedForm from '@/components/SharedForm';

export default function MenteeForm() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-12 relative">
      <Link to="/">
        <img src="/pictures/nsbelogo.png" alt="NSBE Logo" className="absolute top-4 left-4 w-16 h-auto cursor-pointer" />
      </Link>

      <div className="w-full max-w-3xl">
        <SharedForm role="mentee" />
      </div>
    </div>
  );
}
