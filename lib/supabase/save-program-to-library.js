import { createClient } from './client';

/**
 * Copies a coach's active program (and all its weeks + exercises)
 * into the Library as an independent, reusable copy.
 *
 * @param {string} programId - the id of the program to save
 * @param {string} libraryName - name to give the saved library program
 * @param {string} libraryDescription - optional description
 * @returns {object} the newly created library_programs row
 */
export async function saveProgramToLibrary(programId, libraryName, libraryDescription = '') {
  const supabase = createClient();

  // 1. Confirm the program belongs to the logged-in coach, and get its details
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in.');

  const { data: program, error: programError } = await supabase
    .from('programs')
    .select('id, coach_id')
    .eq('id', programId)
    .single();

  if (programError || !program) throw new Error('Program not found.');
  if (program.coach_id !== user.id) throw new Error('This program does not belong to you.');

  // 2. Pull all weeks for this program
  const { data: weeks, error: weeksError } = await supabase
    .from('program_weeks')
    .select('id, week_number, notes')
    .eq('program_id', programId)
    .order('week_number', { ascending: true });

  if (weeksError) throw weeksError;
  if (!weeks || weeks.length === 0) throw new Error('This program has no weeks to save.');

  // 3. Pull all exercises for every week in one go
  const weekIds = weeks.map(w => w.id);
  const { data: exercises, error: exercisesError } = await supabase
    .from('program_exercises')
    .select('*')
    .in('program_week_id', weekIds)
    .order('order_index', { ascending: true });

  if (exercisesError) throw exercisesError;

  // 4. Create the new library_programs "shelf" entry
  const { data: newLibraryProgram, error: createProgramError } = await supabase
    .from('library_programs')
    .insert({
      coach_id: user.id,
      name: libraryName,
      description: libraryDescription
    })
    .select()
    .single();

  if (createProgramError) throw createProgramError;

  // 5. Recreate each week under the new library program, keeping a map
  //    of old week id -> new library week id so exercises attach correctly
  const weekIdMap = {};

  for (const week of weeks) {
    const { data: newWeek, error: newWeekError } = await supabase
      .from('library_program_weeks')
      .insert({
        library_program_id: newLibraryProgram.id,
        week_number: week.week_number
      })
      .select()
      .single();

    if (newWeekError) throw newWeekError;
    weekIdMap[week.id] = newWeek.id;
  }

  // 6. Recreate each exercise, pointed at its new library week
  const exerciseRows = (exercises || []).map(ex => ({
    library_program_week_id: weekIdMap[ex.program_week_id],
    day_of_week: ex.day_of_week,
    exercise_id: ex.exercise_id,
    sets: ex.sets,
    reps_target: ex.reps_target,
    weight: ex.weight,
    target_rpe: ex.target_rpe,
    target_percentage: ex.target_percentage,
    rest_seconds: ex.rest_seconds,
    order_index: ex.order_index
  }));

  if (exerciseRows.length > 0) {
    const { error: insertExercisesError } = await supabase
      .from('library_program_exercises')
      .insert(exerciseRows);

    if (insertExercisesError) throw insertExercisesError;
  }

  return newLibraryProgram;
}
