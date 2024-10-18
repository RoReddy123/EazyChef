// DailyNutritionTracker.js

import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ProgressBar } from 'react-native-paper'; // For progress bars
import { AuthContext } from './../AuthProvider'; // Adjust the path if necessary
import { doc, onSnapshot, getDoc } from 'firebase/firestore'; // Firestore functions
import { db } from './../../configs/FirebaseConfig'; // Firebase configuration
import { isValid, isSameDay, parseISO } from 'date-fns'; // Date parsing and comparison

const screenWidth = Dimensions.get('window').width;

// Define daily nutritional goals (can be made dynamic or user-configurable)
const DAILY_GOALS = {
  calories: 2000,      // cal
  protein: 50,         // grams
  carbohydrates: 250,  // grams
  fat: 70,             // grams
};

// Define colors for each macronutrient
const COLORS = {
  calories: '#ff6347',      // Tomato
  protein: '#1e90ff',       // DodgerBlue
  carbohydrates: '#32cd32', // LimeGreen
  fat: '#ffa500',           // Orange
};

const DailyNutritionTracker = () => {
  const [mealPlan, setMealPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, authLoading } = useContext(AuthContext);

  // Reference to store unsubscribe functions for cleanup
  const unsubscribeRef = useRef([]);

  // State for aggregated nutritional data
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalProtein, setTotalProtein] = useState(0);
  const [totalCarbohydrates, setTotalCarbohydrates] = useState(0);
  const [totalFat, setTotalFat] = useState(0);

  // Function to set up the real-time listener on the meal plan
  const setupMealPlanListener = () => {
    if (!user) return;

    setLoading(true);

    // Reference to the user's meal plan document
    const mealPlanDocRef = doc(db, 'MealPlans', user.uid);

    // Set up the onSnapshot listener
    const unsubscribeMealPlan = onSnapshot(
      mealPlanDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const mealPlanData = docSnapshot.data();
          console.log("Fetched Meal Plan Data:", mealPlanData); // Logging
          setMealPlan(mealPlanData);
        } else {
          // Initialize the document if it doesn't exist
          console.warn("Meal Plan document does not exist. Initializing empty meal plan.");
          setMealPlan({});
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching meal plan:', error);
        Alert.alert('Error', 'Failed to fetch meal plan.');
        setLoading(false);
      }
    );

    // Store the unsubscribe function for cleanup
    unsubscribeRef.current.push(unsubscribeMealPlan);
  };

  // Function to fetch recipes from AllRecipes collection based on recipeIds
  const fetchRecipesData = async (recipeIds) => {
    if (recipeIds.length === 0) {
      console.warn("No recipe IDs found for this meal plan.");
      return [];
    }

    const recipes = [];

    for (const recipeId of recipeIds) {
      console.log(`Fetching recipe with ID: ${recipeId}`);
      try {
        const recipeDocRef = doc(db, 'AllRecipes', recipeId);
        const recipeDoc = await getDoc(recipeDocRef);
        if (recipeDoc.exists()) {
          const recipeData = recipeDoc.data();
          console.log(`Fetched recipe: ${recipeId}`, recipeData);

          if (recipeData.totalNutrition) {
            recipes.push({ id: recipeId, ...recipeData });
          } else {
            console.warn(`Recipe ID ${recipeId} lacks 'totalNutrition' field.`);
          }
        } else {
          console.warn(`Recipe with ID ${recipeId} not found in AllRecipes.`);
        }
      } catch (error) {
        console.error(`Error fetching recipe ID ${recipeId}:`, error);
      }
    }

    console.log(`Fetched ${recipes.length} valid recipes out of ${recipeIds.length} requested.`);
    return recipes;
  };

  // Function to aggregate nutritional data for today
  const aggregateDailyNutrition = async () => {
    if (!mealPlan) {
      console.warn('No meal plan available');
      return;
    }

    let calories = 0;
    let protein = 0;
    let carbohydrates = 0;
    let fat = 0;

    const recipeIdsSet = new Set();
    const today = new Date();

    console.log("Starting aggregation for date:", today.toDateString());

    // Iterate through each mealTime (e.g., breakfast, lunch, dinner) in the plan
    Object.keys(mealPlan).forEach((mealTime) => {
      const mealArray = mealPlan[mealTime];
      if (Array.isArray(mealArray)) {
        console.log(`Processing ${mealTime}:`, mealArray);
        // Iterate over the array of meals
        mealArray.forEach((meal, index) => {
          let mealDate;

          // Handle different date formats
          if (meal.date instanceof Date) {
            mealDate = meal.date;
          } else if (typeof meal.date === 'string') {
            // Parse 'YYYY-MM-DD' string to Date object
            mealDate = parseISO(meal.date);
          } else {
            console.warn(`Unknown date format for meal at index ${index} in ${mealTime}:`, meal);
            return;
          }

          console.log(`Meal Time: ${mealTime}, Meal Index: ${index}, Date: ${mealDate.toISOString()}`);

          if (isValid(mealDate) && isSameDay(mealDate, today)) {
            console.log(`Meal matches today's date. Recipe ID: ${meal.recipeId}`);
            if (meal.recipeId) {
              recipeIdsSet.add(meal.recipeId);
            } else {
              console.warn(`Meal at index ${index} in ${mealTime} lacks a recipeId.`);
            }
          }
        });
      } else {
        console.warn(`Expected an array for mealTime "${mealTime}", but got:`, mealArray);
      }
    });

    const recipeIds = Array.from(recipeIdsSet);
    console.log("Collected Recipe IDs for today:", recipeIds);

    // Fetch recipes data from AllRecipes collection
    const recipesData = await fetchRecipesData(recipeIds);
    console.log("Fetched recipes data for today:", recipesData);

    if (recipesData.length === 0) {
      console.warn("No valid recipes fetched for today's recipe IDs.");
    }

    // Create a map of recipeId to totalNutrition
    const recipeNutritionMap = {};
    recipesData.forEach((recipe) => {
      if (recipe.id && recipe.totalNutrition) {
        recipeNutritionMap[recipe.id] = recipe.totalNutrition;
      } else {
        console.warn(`No nutrition data found for recipe ID: ${recipe.id}`);
      }
    });

    console.log("Recipe Nutrition Map:", recipeNutritionMap);

    // Sum up nutritional data for today
    Object.keys(mealPlan).forEach((mealTime) => {
      const mealArray = mealPlan[mealTime];
      if (Array.isArray(mealArray)) {
        mealArray.forEach((meal) => {
          let mealDate;

          // Handle different date formats
          if (meal.date instanceof Date) {
            mealDate = meal.date;
          } else if (typeof meal.date === 'string') {
            // Parse 'YYYY-MM-DD' string to Date object
            mealDate = parseISO(meal.date);
          } else {
            console.warn("Unknown date format for meal:", meal);
            return;
          }

          if (isValid(mealDate) && isSameDay(mealDate, today)) {
            const nutrition = recipeNutritionMap[meal.recipeId];
            if (nutrition) {
              calories += nutrition.calories || 0;
              protein += nutrition.protein || 0;
              carbohydrates += nutrition.carbohydrates || 0;
              fat += nutrition.fat || 0;
              console.log(`Added nutrition from recipe ${meal.recipeId}:`, nutrition);
            } else {
              console.warn("No nutrition data found for recipe ID:", meal.recipeId);
            }
          }
        });
      }
    });

    // Round values to the nearest tenth
    setTotalCalories(Math.round(calories * 10) / 10);
    setTotalProtein(Math.round(protein * 10) / 10);
    setTotalCarbohydrates(Math.round(carbohydrates * 10) / 10);
    setTotalFat(Math.round(fat * 10) / 10);

    console.log('Aggregated Nutrition Data for Today:', {
      totalCalories: calories,
      totalProtein: protein,
      totalCarbohydrates: carbohydrates,
      totalFat: fat,
    });
  };

  // useEffect to set up the listener on component mount and clean up on unmount
  useEffect(() => {
    if (user && !authLoading) {
      setupMealPlanListener();
    }

    // Cleanup function to unsubscribe from all listeners when component unmounts
    return () => {
      unsubscribeRef.current.forEach((unsub) => unsub());
      unsubscribeRef.current = [];
    };
  }, [user, authLoading]);

  // useEffect to aggregate nutritional data whenever mealPlan changes
  useEffect(() => {
    if (mealPlan) {
      aggregateDailyNutrition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealPlan]);

  // Loading Indicator
  if (authLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  // Prompt to log in if user is not authenticated
  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Please log in to view your nutrition data.</Text>
      </View>
    );
  }

  // Check if there are any meals for today
  const hasMealsToday = totalCalories > 0 || totalProtein > 0 || totalCarbohydrates > 0 || totalFat > 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Daily Nutrition Summary</Text>

      {hasMealsToday ? (
        // Nutrition Progress Bars
        <View style={styles.nutritionRowContainer}>
          {/* Calories */}
          <View style={styles.nutritionItem}>
            <View style={styles.nutritionHeader}>
              <Text style={styles.nutritionLabel}>Calories</Text>
              <Text style={styles.nutritionValue}>{totalCalories} cal</Text>
            </View>
            <ProgressBar
              progress={
                totalCalories / DAILY_GOALS.calories > 1
                  ? 1
                  : totalCalories / DAILY_GOALS.calories
              }
              color={COLORS.calories}
              style={styles.progressBar}
            />
            <Text style={styles.goalText}>
              {totalCalories} / {DAILY_GOALS.calories} cal
            </Text>
          </View>

          {/* Protein */}
          <View style={styles.nutritionItem}>
            <View style={styles.nutritionHeader}>
              <Text style={styles.nutritionLabel}>Protein</Text>
              <Text style={styles.nutritionValue}>{totalProtein} g</Text>
            </View>
            <ProgressBar
              progress={
                totalProtein / DAILY_GOALS.protein > 1
                  ? 1
                  : totalProtein / DAILY_GOALS.protein
              }
              color={COLORS.protein}
              style={styles.progressBar}
            />
            <Text style={styles.goalText}>
              {totalProtein} / {DAILY_GOALS.protein} g
            </Text>
          </View>

          {/* Carbohydrates */}
          <View style={styles.nutritionItem}>
            <View style={styles.nutritionHeader}>
              <Text style={styles.nutritionLabel}>Carbohydrates</Text>
              <Text style={styles.nutritionValue}>{totalCarbohydrates} g</Text>
            </View>
            <ProgressBar
              progress={
                totalCarbohydrates / DAILY_GOALS.carbohydrates > 1
                  ? 1
                  : totalCarbohydrates / DAILY_GOALS.carbohydrates
              }
              color={COLORS.carbohydrates}
              style={styles.progressBar}
            />
            <Text style={styles.goalText}>
              {totalCarbohydrates} / {DAILY_GOALS.carbohydrates} g
            </Text>
          </View>

          {/* Fat */}
          <View style={styles.nutritionItem}>
            <View style={styles.nutritionHeader}>
              <Text style={styles.nutritionLabel}>Fat</Text>
              <Text style={styles.nutritionValue}>{totalFat} g</Text>
            </View>
            <ProgressBar
              progress={
                totalFat / DAILY_GOALS.fat > 1
                  ? 1
                  : totalFat / DAILY_GOALS.fat
              }
              color={COLORS.fat}
              style={styles.progressBar}
            />
            <Text style={styles.goalText}>
              {totalFat} / {DAILY_GOALS.fat} g
            </Text>
          </View>
        </View>
      ) : (
        // Message when no meals are found for today
        <View style={styles.noMealsContainer}>
          <Text style={styles.noMealsText}>No meals found for today. Please add your meals.</Text>
        </View>
      )}
    </ScrollView>
  );
};

// Styles for the component
const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F0F8FF',
    alignItems: 'center',
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 30,
    textAlign: 'center',
  },
  nutritionRowContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Wrap to move to the next line if it exceeds the screen width
    justifyContent: 'space-between', // Add space between the two columns
  },
  nutritionItem: {
    width: '48%', // Ensure two columns per row
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // For Android shadow
  },
  nutritionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nutritionLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  nutritionValue: {
    fontSize: 16,
    color: '#555',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    marginTop: 10,
    marginBottom: 5,
  },
  goalText: {
    fontSize: 14,
    color: '#555',
  },
  noMealsContainer: {
    marginTop: 50,
    alignItems: 'center',
  },
  noMealsText: {
    fontSize: 18,
    color: '#555',
    textAlign: 'center',
  },
});

export default DailyNutritionTracker;
