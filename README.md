
# PSU NSBE Mentor Project
This template provides a minimal setup to get React working in Vite 

## Overview
This repo contains the React front‑end built with Vite thus far. Ultimately, I'm hoping to make 
this project live via an accessible website. The overall goal of the project is to automate 
the mentor/mentee matching processes for the BBBS program but potentially expand to add'l mentor 
programs.




##  TO DO 

### Mentor Page 
- [ ] Get the embedings for hobby list and set up openAI API Calls 
- [ ] Finish the spotify implementation 
- [ ] Add a feature where if the name has been put in before it asks users to delete previous entry
or pulls the past entry for edit? 

### Mentee Page 
- [ ] Copy everything over from mentor pages and modify where needed. 

### Admin Page ⚠️ 

The idea is listed in the second paragraph of pages 

- [ ] General look...we can start developing functionality later (ASAP lol, but start somewhere)

### Backend ⚠️ 
- [ ] Setup a backend that can store form entries and run the matching algorithm 

## The Breakdown

### Pages 
Im thinking four pages. Home is self-explanatory, the mentor/mentee matching pages will be where prospective 
enter their info. These three pages are already thought out. 

The admin page is TBD. I'm thinking start w/ a login, have a dashboard of sorts that allows admin to start the 
matching process (which stops entries), enter pre-determined matches, see matches, etc. I was thinking the matches should kind of look like tinder cards? idk 

## Prerequisites
So I'm using VS Code, which has been really easy. I'm not sure how setup might work with other IDEs, but I feel like it'd 
be pretty similar. 
### Dependencies 

- **Node.js** – version 18 or newer is recommended
- **npm** (usually installed with Node.js)
- **Python 3** if you want to run the scraper

If you run the following in terminal, you should be straight 
<pre>
node -v 
npm -v 
npm install #should install all dependencies from the packages.json 
</pre>


<pre>
brew install python
# Use the following two to check that python and pip were installed correctly 
python3 --version 
pip3 --version
pip3 install -r requirements.txt
</pre>


## Installation
Clone the repository and install the dependencies for both the main project
and the backend service:

## Expanding the ESLint configuration
```bash
# Frontend / main project
git clone <repo-url>
cd NSBE-MENTOR-PROJECT
npm install

# Backend service
cd spotify-search-backend
npm install
```

## Environment Variables

THIS SHOULDN'T BE NECESSARY UNLESS YOU'RE WORKING ON THE SPOTIFY IMPlEMENTATION

The Spotify backend expects a `.env` file inside `spotify-search-backend`
containing your Spotify credentials:

```env
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
```


## Running the Project
From the project root run the development server for the React app:

```bash
npm run dev
```

NOT NECESSARY UNLESS WORKING ON SPOTIFY IMPLEMENTATION

Start the Spotify search backend in a separate terminal:

```bash
cd spotify-search-backend
node index.js        # or `npm start` if you add a start script
```


## Contributing
- Start on a new feature branch!
- Run the linter before committing changes:
  ```bash
  npm run lint
  ```
- Build the production version with:
  ```bash
  npm run build
  ```
- Open a pull request for any improvements or bug fixes.