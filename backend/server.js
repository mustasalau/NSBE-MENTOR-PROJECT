import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/submit-form', async (req, res) => {  const data = req.body;

  try {
    await pool.query(
      `INSERT INTO mentor_forms (
        role,
        first_name, 
        last_name, 
        email, 
        personal_email,
        student_id, 
        major, 
        gender, 
        year, 
        pair_gender_preference,
        meeting_frequency,
        hobbies, 
        musical_artists, 
        organizations, 
        personality_words,
        expectations, 
        ideal_mentee, 
        mentee_in_major, 
        open_to_multiple
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        data.role,
        data.firstName,
        data.lastName,
        data.email,
        data.personalEmail,
        data.studentId,
        data.major,
        data.gender,
        data.year,
        data.pairGenderPreference,
        data.meetingFrequency,
        JSON.stringify(data.hobbies),
        JSON.stringify(data.musicalArtists),
        JSON.stringify(data.organizations),
        JSON.stringify(data.personalityWords),
        data.expectations,
        data.idealMentee,
        data.menteeInMajor,
        data.openToMultiple
      ]
    );

    res.status(200).json({ message: 'Form submitted successfully!' });
  } catch (err) {
    console.error('Database insert error:', err);
    res.status(500).json({ error: 'Failed to submit form.' });
  }
});

const PORT = process.env.PORT || 5009;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
