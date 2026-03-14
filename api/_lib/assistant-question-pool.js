const QUESTION_POOL = [
  {
    id: 'q_location_now',
    text: 'Where are you right now?',
    options: ['Home', 'School/College', 'Work', 'Mall', 'Gym', 'Traveling', 'Other']
  },
  {
    id: 'q_activity_now',
    text: 'What are you currently doing?',
    options: ['Studying', 'Working', 'Relaxing', 'Shopping', 'Exercising', 'Commuting', 'Other']
  },
  {
    id: 'q_plan_later',
    text: 'Do you have any plans later today?',
    options: ['Yes, important plans', 'A few small plans', 'Not sure yet', 'No plans']
  },
  {
    id: 'q_day_mood',
    text: 'How is your day going?',
    options: ['Great', 'Good', 'Okay', 'A little stressful', 'Tired']
  },
  {
    id: 'q_need_reminder',
    text: 'Would you like me to remind you about anything?',
    options: ['Yes, definitely', 'Maybe later', 'Not right now']
  },
  {
    id: 'q_heading_soon',
    text: 'Are you heading somewhere soon?',
    options: ['Yes, within 30 min', 'Yes, later today', 'No', 'Not sure']
  },
  {
    id: 'q_focus_goal',
    text: 'What should we focus on for the next few hours?',
    options: ['Work', 'Study', 'Health', 'Errands', 'Rest', 'Family']
  },
  {
    id: 'q_transport_mode',
    text: 'How are you planning to travel today?',
    options: ['Walk', 'Bike', 'Public transport', 'Car', 'Ride-share', 'Not traveling']
  }
];

const DAILY_PROMPT_SLOTS = [8, 10, 12, 15, 18, 21];

module.exports = {
  QUESTION_POOL,
  DAILY_PROMPT_SLOTS
};
