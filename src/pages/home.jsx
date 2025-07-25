import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

const Home = () => {
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* YouTube Video Embed */}
      <iframe
        className="absolute top-0 left-0 w-full h-full object-cover"
        src="https://www.youtube.com/embed/vhBu54vWlFQ?autoplay=1&mute=1&loop=1&playlist=vhBu54vWlFQ&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1"
        title="NSBE Video Background"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{
          pointerEvents: 'none', // Prevents interaction with the video
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen bg-black/50 px-4">
        {/* Logo Centered Above Box */}
        <img
          src="/pictures/nsbelogo.png"
          alt="NSBE Logo"
          className="mb-6 w-20 h-auto"
        />

        {/* White Box with Text + Buttons */}
        <div className="bg-white bg-opacity-90 p-6 sm:p-8 rounded-xl shadow-lg max-w-xl w-full text-center mx-4">
          <p className="text-base md:text-lg text-gray-700 mb-1">
            Welcome to
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            PSU NSBE's <br />
            Big Brother Big Sister Program
          </h1>

          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Link
              to="/mentor"
              className="bg-black text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg text-base sm:text-lg font-medium hover:bg-gray-800 transition"
            >
              Become a Mentor
            </Link>
            <Link
              to="/mentee"
              className="bg-yellow-400 text-black px-4 sm:px-6 py-2 sm:py-3 rounded-lg text-base sm:text-lg font-medium hover:bg-yellow-300 transition"
            >
              Join as a Mentee
            </Link>
          </div>
        </div>
        
        <Link
          to="/matching"
          className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-white text-sm underline hover:text-yellow-400 transition"
        >
          admin 
        </Link>
      </div>
    </div>
  );
};

export default Home;
