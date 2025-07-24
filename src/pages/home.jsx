import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

const Home = () => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch((err) => {
          console.warn('play() failed:', err);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    document.body.style.overflow = 'hidden';
    
    if (video) {
      video.src = '/videos/NSBEVid.mov';
      // Start muted to comply with autoplay policies
      video.muted = true;
      setIsMuted(true);
      video.play().catch((err) => {
        console.warn('Autoplay failed:', err);
      });
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Single looping video */}
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover"
        loop
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Video Controls Overlay */}
      <div 
        className="absolute top-4 right-4 z-20"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        <div className={`flex space-x-2 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-70'}`}>
          {/* Play/Pause Button */}
          <button
            onClick={togglePlayPause}
            className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm"
            title={isPlaying ? 'Pause video' : 'Play video'}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          {/* Mute/Unmute Button */}
          <button
            onClick={toggleMute}
            className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200 backdrop-blur-sm"
            title={isMuted ? 'Unmute video' : 'Mute video'}
          >
            {isMuted ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </button>
        </div>
      </div>

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
