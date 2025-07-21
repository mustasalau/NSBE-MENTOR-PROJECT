import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function DuplicatesPage() {
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDuplicates();
  }, []);

  const fetchDuplicates = async () => {
    try {
      const response = await axios.get("https://nsbe-mentor-project.onrender.com/api/duplicates");
      setDuplicates(response.data.duplicates || []);
    } catch (error) {
      console.error("Error fetching duplicates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (submissionId, groupIndex, submissionIndex) => {
    if (!confirm("Are you sure you want to delete this submission? This action cannot be undone.")) {
      return;
    }

    setDeleting(submissionId);
    try {
      await axios.delete(`https://nsbe-mentor-project.onrender.com/api/submission/${submissionId}`);
      
      // Update the duplicates state by removing the deleted submission
      setDuplicates(prevDuplicates => {
        const newDuplicates = [...prevDuplicates];
        newDuplicates[groupIndex].submissions.splice(submissionIndex, 1);
        
        // If only one submission remains, remove the entire group
        if (newDuplicates[groupIndex].submissions.length <= 1) {
          newDuplicates.splice(groupIndex, 1);
        }
        
        return newDuplicates;
      });
    } catch (error) {
      console.error("Error deleting submission:", error);
      alert("Failed to delete submission. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getDuplicateTypeLabel = (type) => {
    return type === 'student_id' ? 'Student ID' : 'Name';
  };

  const getTypeColor = (type) => {
    return type === 'student_id' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading duplicates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Duplicate Submissions</h1>
              <p className="text-gray-600 mt-1">
                {duplicates.length === 0 
                  ? "No duplicates found" 
                  : `Found ${duplicates.length} duplicate group${duplicates.length !== 1 ? 's' : ''}`
                }
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>

        {/* No duplicates message */}
        {duplicates.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Duplicates Found</h3>
            <p className="text-gray-600">All submissions appear to be unique based on student ID and name matching.</p>
          </div>
        )}

        {/* Duplicates list */}
        {duplicates.map((duplicateGroup, groupIndex) => (
          <div key={`${duplicateGroup.type}-${duplicateGroup.identifier}`} className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="border-b border-gray-200 pb-4 mb-4">
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(duplicateGroup.type)}`}>
                  {getDuplicateTypeLabel(duplicateGroup.type)}
                </span>
                <h3 className="text-lg font-semibold text-gray-900">
                  {duplicateGroup.identifier}
                </h3>
                <span className="text-sm text-gray-500">
                  ({duplicateGroup.submissions.length} submissions)
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {duplicateGroup.submissions.map((submission, submissionIndex) => (
                <div key={submission.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {submission.firstName} {submission.lastName}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Student ID: {submission.studentId}
                          </p>
                        </div>
                        <div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            submission.role === 'mentor' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {submission.role}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          <p>Submitted: {formatTimestamp(submission.timestamp)}</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(submission.id, groupIndex, submissionIndex)}
                      disabled={deleting === submission.id}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-3 py-2 rounded text-sm flex items-center space-x-1 transition-colors"
                    >
                      {deleting === submission.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 