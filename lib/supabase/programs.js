// lib/supabase/programs.js
// Functions for creating and generating a client's personalized program

import { supabase } from './client';

/**
 * Creates a new program for a specific client.
 * Each program belongs to exactly one client (personalized, not reusable).
 */
export async function createProgram({ coachId, clientId, name, description, durationWeeks, startDate }) {
  const { data, error } = await supabase
    .from('programs')
    .insert({
      coach_id: coachId,
      client_id: clientId,
      name,
      description,
      duration_weeks: durationWeeks,
      start_date: startDate, // 'YYYY-MM-DD'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Adds a week to a program.
 */
export async function addProgramWeek({ programId, weekNumber, notes }) {
  const { data, error } = await supabase
    .from('program_weeks')
    .insert({
      program_id: programId,
      week_number: weekNumber,
      notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Adds an exercise to a specific program week.
 */
export async function addProgramExercise({
  programWeekId,
  dayOfWeek,      // 1 = Monday ... 7 = Sunday
  exerciseId,
  sets,
  repsTarget,
  weight,
  targetRpe,
  targetPercentage,
  restSeconds,
  orderIndex,
}) {
  const { data, error } = await supabase
    .from('program_exercises')
    .insert({
      program_week_id: programWeekId,
      day_of_week: dayOfWeek,
      exercise_id: exerciseId,
      sets,
      reps_target: repsTarget,
      weight,
      target_rpe: targetRpe,
      target_percentage: targetPercentage,
      rest_seconds: restSeconds,
      order_index: orderIndex,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Generates (or regenerates) the client's dated calendar entries
 * from the program template. Call this after the coach finishes
 * building the program, or after any edit to it.
 */
export async function generateProgramWorkouts(programId) {
  const { error } = await supabase.rpc('generate_program_workouts', {
    p_program_id: programId,
  });

  if (error) throw error;
  return true;
}
