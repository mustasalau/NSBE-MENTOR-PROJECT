#!/bin/zsh

# NSBE Mentor-Mentee Submission Script
# Usage: ./add_submissions.zsh

# Configuration
BACKEND_URL="http://localhost:5009"
API_ENDPOINT="$BACKEND_URL/api/submit"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    echo -e "${1}${2}${NC}"
}

# Function to submit data
submit_data() {
    local json_data="$1"
    local name="$2"
    
    print_color $BLUE "📤 Submitting $name..."
    
    response=$(curl -s -X POST "$API_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$json_data")
    
    if [[ $? -eq 0 ]]; then
        print_color $GREEN "✅ Successfully submitted $name"
        echo "Response: $response"
    else
        print_color $RED "❌ Failed to submit $name"
    fi
    echo ""
}

# Predefined mentor submissions
submit_mentors() {
    print_color $PURPLE "👨‍🏫 Adding Mentor Submissions..."
    
    # Mentor 1: CS Senior open to multiple
    submit_data '{
        "role": "mentor",
        "firstName": "Alex",
        "lastName": "Rodriguez",
        "email": "alex.rodriguez@example.com",
        "major": "Computer Science",
        "gender": "Male",
        "year": "Senior",
        "studentId": "123456789",
        "hobbies": ["Programming", "Gaming", "Basketball"],
        "musicalArtists": [
            {"genres": ["hip-hop", "rap"], "displayName": "HUMBLE. by Kendrick Lamar"},
            {"genres": ["pop", "electronic"], "displayName": "Blinding Lights by The Weeknd"}
        ],
        "personalityWords": [
            {"raw": "Leadership"},
            {"raw": "Patient"},
            {"raw": "Analytical"}
        ],
        "expectations": "Looking to guide students in software development and career planning.",
        "idealMatchDescription": "Motivated students interested in computer science and technology.",
        "organizations": ["NSBE", "ACM"],
        "meetingFrequency": "Weekly",
        "openToMultiple": "Yes",
        "menteeInMajor": "Yes",
        "pairGenderPreference": "No Preference",
        "preferredStudentId": ""
    }' "Alex Rodriguez (Mentor)"

    # Mentor 2: Engineering Junior, single mentee
    submit_data '{
        "role": "mentor",
        "firstName": "Maria",
        "lastName": "Garcia",
        "email": "maria.garcia@example.com",
        "major": "Mechanical Engineering",
        "gender": "Female",
        "year": "Junior",
        "studentId": "987654321",
        "hobbies": ["Robotics", "3D Printing", "Soccer"],
        "musicalArtists": [
            {"genres": ["pop", "latin"], "displayName": "Hips Dont Lie by Shakira"},
            {"genres": ["r&b", "soul"], "displayName": "Respect by Aretha Franklin"}
        ],
        "personalityWords": [
            {"raw": "Creative"},
            {"raw": "Determined"},
            {"raw": "Collaborative"}
        ],
        "expectations": "Want to help mentees with engineering fundamentals and project management.",
        "idealMatchDescription": "Dedicated engineering students who want to learn and grow.",
        "organizations": ["NSBE", "SWE"],
        "meetingFrequency": "Bi-Weekly",
        "openToMultiple": "No",
        "menteeInMajor": "Yes",
        "pairGenderPreference": "Female",
        "preferredStudentId": ""
    }' "Maria Garcia (Mentor)"
}

# Predefined mentee submissions
submit_mentees() {
    print_color $CYAN "👩‍🎓 Adding Mentee Submissions..."
    
    # Mentee 1: CS Freshman
    submit_data '{
        "role": "mentee",
        "firstName": "Jordan",
        "lastName": "Smith",
        "email": "jordan.smith@example.com",
        "major": "Computer Science",
        "gender": "Non-binary",
        "year": "Freshman",
        "studentId": "111222333",
        "hobbies": ["Coding", "Gaming", "Reading"],
        "musicalArtists": [
            {"genres": ["hip-hop", "rap"], "displayName": "Good Kid by Kendrick Lamar"},
            {"genres": ["electronic", "pop"], "displayName": "One More Time by Daft Punk"}
        ],
        "personalityWords": [
            {"raw": "Curious"},
            {"raw": "Motivated"},
            {"raw": "Tech-savvy"}
        ],
        "expectations": "Looking for guidance in programming languages and internship opportunities.",
        "idealMatchDescription": "Experienced mentor in computer science with industry knowledge.",
        "organizations": ["NSBE"],
        "meetingFrequency": "Weekly",
        "menteeInMajor": "Yes",
        "pairGenderPreference": "No Preference",
        "preferredStudentId": ""
    }' "Jordan Smith (Mentee)"

    # Mentee 2: Engineering Sophomore
    submit_data '{
        "role": "mentee",
        "firstName": "Zara",
        "lastName": "Johnson",
        "email": "zara.johnson@example.com",
        "major": "Mechanical Engineering",
        "gender": "Female",
        "year": "Sophomore",
        "studentId": "444555666",
        "hobbies": ["Design", "Robotics", "Photography"],
        "musicalArtists": [
            {"genres": ["r&b", "neo-soul"], "displayName": "Best Part by Daniel Caesar"},
            {"genres": ["pop", "indie"], "displayName": "Heat Waves by Glass Animals"}
        ],
        "personalityWords": [
            {"raw": "Creative"},
            {"raw": "Detail-oriented"},
            {"raw": "Ambitious"}
        ],
        "expectations": "Need help with advanced engineering courses and research opportunities.",
        "idealMatchDescription": "Senior engineering student or professional with research experience.",
        "organizations": ["NSBE", "SWE"],
        "meetingFrequency": "Bi-Weekly",
        "menteeInMajor": "Yes",
        "pairGenderPreference": "Female",
        "preferredStudentId": ""
    }' "Zara Johnson (Mentee)"

    # Mentee 3: Business student looking for STEM mentor
    submit_data '{
        "role": "mentee",
        "firstName": "Cameron",
        "lastName": "Lee",
        "email": "cameron.lee@example.com",
        "major": "Business Administration",
        "gender": "Male",
        "year": "Sophomore",
        "studentId": "777888999",
        "hobbies": ["Entrepreneurship", "Basketball", "Podcasts"],
        "musicalArtists": [
            {"genres": ["hip-hop", "trap"], "displayName": "Started From the Bottom by Drake"},
            {"genres": ["jazz", "hip-hop"], "displayName": "The Choice Is Yours by Black Sheep"}
        ],
        "personalityWords": [
            {"raw": "Entrepreneurial"},
            {"raw": "Networker"},
            {"raw": "Strategic"}
        ],
        "expectations": "Want to learn about tech entrepreneurship and STEM business applications.",
        "idealMatchDescription": "STEM professional with business or entrepreneurship experience.",
        "organizations": ["NSBE", "Business Club"],
        "meetingFrequency": "Monthly",
        "menteeInMajor": "No",
        "pairGenderPreference": "No Preference",
        "preferredStudentId": ""
    }' "Cameron Lee (Mentee)"

    # Mentee 4: CS student with specific mentor preference
    submit_data '{
        "role": "mentee",
        "firstName": "Taylor",
        "lastName": "Brown",
        "email": "taylor.brown@example.com",
        "major": "Computer Science",
        "gender": "Female",
        "year": "Freshman",
        "studentId": "101010101",
        "hobbies": ["Programming", "Art", "Music Production"],
        "musicalArtists": [
            {"genres": ["pop", "alternative"], "displayName": "Anti-Hero by Taylor Swift"},
            {"genres": ["indie", "electronic"], "displayName": "Midnight City by M83"}
        ],
        "personalityWords": [
            {"raw": "Creative"},
            {"raw": "Persistent"},
            {"raw": "Collaborative"}
        ],
        "expectations": "Looking for mentorship in software development and creative coding.",
        "idealMatchDescription": "Creative technologist who combines programming with artistic pursuits.",
        "organizations": ["NSBE", "Art Club"],
        "meetingFrequency": "Weekly",
        "menteeInMajor": "Yes",
        "pairGenderPreference": "No Preference",
        "preferredStudentId": "123456789"
    }' "Taylor Brown (Mentee - prefers Alex)"
}

# Interactive custom submission
custom_submission() {
    print_color $YELLOW "📝 Custom Submission Creator"
    
    echo "Enter submission details:"
    read "role?Role (mentor/mentee): "
    read "first_name?First Name: "
    read "last_name?Last Name: "
    read "email?Email: "
    read "major?Major: "
    read "gender?Gender: "
    read "year?Year: "
    read "student_id?Student ID (9 digits): "
    
    # For simplicity, use defaults for complex fields
    if [[ "$role" == "mentor" ]]; then
        read "open_to_multiple?Open to multiple mentees? (Yes/No): "
        open_to_multiple_field="\"openToMultiple\": \"$open_to_multiple\","
    else
        open_to_multiple_field=""
    fi
    
    submit_data "{
        \"role\": \"$role\",
        \"firstName\": \"$first_name\",
        \"lastName\": \"$last_name\",
        \"email\": \"$email\",
        \"major\": \"$major\",
        \"gender\": \"$gender\",
        \"year\": \"$year\",
        \"studentId\": \"$student_id\",
        \"hobbies\": [\"Reading\", \"Music\"],
        \"musicalArtists\": [
            {\"genres\": [\"pop\"], \"displayName\": \"Example Song by Artist\"}
        ],
        \"personalityWords\": [
            {\"raw\": \"Friendly\"},
            {\"raw\": \"Motivated\"}
        ],
        \"expectations\": \"Looking for great mentorship opportunities.\",
        \"idealMatchDescription\": \"Supportive mentor who can guide my academic and career development.\",
        \"organizations\": [\"NSBE\"],
        \"meetingFrequency\": \"Weekly\",
        $open_to_multiple_field
        \"menteeInMajor\": \"Yes\",
        \"pairGenderPreference\": \"No Preference\",
        \"preferredStudentId\": \"\"
    }" "$first_name $last_name ($role)"
}

# Test backend connection
test_connection() {
    print_color $BLUE "🔍 Testing backend connection..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/submissions")
    
    if [[ "$response" == "200" ]]; then
        print_color $GREEN "✅ Backend is running and accessible"
    else
        print_color $RED "❌ Backend not accessible (HTTP $response)"
        print_color $YELLOW "Make sure your backend is running on $BACKEND_URL"
        exit 1
    fi
}

# Main menu
show_menu() {
    print_color $PURPLE "🎓 NSBE Mentor-Mentee Submission Tool"
    echo ""
    echo "Choose an option:"
    echo "1) Test backend connection"
    echo "2) Add sample mentors (2 mentors)"
    echo "3) Add sample mentees (4 mentees)"
    echo "4) Add all samples (mentors + mentees)"
    echo "5) Custom submission"
    echo "6) Exit"
    echo ""
}

# Main script execution
main() {
    while true; do
        show_menu
        read "choice?Enter your choice (1-6): "
        
        case $choice in
            1)
                test_connection
                ;;
            2)
                test_connection
                submit_mentors
                ;;
            3)
                test_connection
                submit_mentees
                ;;
            4)
                test_connection
                submit_mentors
                submit_mentees
                ;;
            5)
                test_connection
                custom_submission
                ;;
            6)
                print_color $GREEN "👋 Goodbye!"
                exit 0
                ;;
            *)
                print_color $RED "❌ Invalid choice. Please select 1-6."
                ;;
        esac
        
        echo ""
        read "continue?Press Enter to continue..."
        clear
    done
}

# Run the script
clear
main 