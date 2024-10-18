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
import { ProgressBar } from 'react-native-paper';
import { AuthContext } from './../AuthProvider';
import {
  doc,
  onSnapshot,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './../../configs/FirebaseConfig';
import {
  startOfWeek,
  addDays,
  isValid,
  isWithinInterval,
  parse,
} from 'date-fns';

const screenWidth = Dimensions.get('window').width;

// Define daily nutritional goals (can be made dynamic or user-configurable)
const DAILY_GOALS = {
  calories: 2000,      // cal
  protein: 50,         // grams
  carbohydrates: 250,  // grams
  fat: 70,             // grams
};

// Define weekly nutritional goals in cal
const WEEKLY_GOALS = {
  calories: DAILY_GOALS.calories * 7,        // 14,000 cal
  protein: DAILY_GOALS.protein * 7,                 // 350 g
  carbohydrates: DAILY_GOALS.carbohydrates * 7,     // 1750 g
  fat: DAILY_GOALS.fat * 7,                         // 490 g
};

// Define colors for each macronutrient
const COLORS = {
  calories: '#ff6347',      // Tomato
  protein: '#1e90ff',       // DodgerBlue
  carbohydrates: '#32cd32', // LimeGreen
  fat: '#ffa500',           // Orange
};

const NutritionTracker = () => {
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

  // Function to get the current week's date range (Sunday to Saturday)
  const getCurrentWeekRange = () => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
    const weekEnd = addDays(weekStart, 6); // Saturday
    console.log('Week Start:', weekStart);
    console.log('Week End:', weekEnd);
    return { weekStart, weekEnd };
  };

  // Function to set up the real-time listener on the meal plan
  const setupMealPlanListener = () => {
    if (!user) return;

    setLoading(true);
    console.log('Setting up meal plan listener for user:', user.uid);

    // Reference to the user's meal plan document
    const mealPlanDocRef = doc(db, 'MealPlans', user.uid);

    // Set up the onSnapshot listener
    const unsubscribeMealPlan = onSnapshot(
      mealPlanDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const mealPlanData = docSnapshot.data();
          console.log('Fetched Meal Plan Data:', mealPlanData);
          setMealPlan(mealPlanData);
        } else {
          console.log('No Meal Plan found for user, initializing...');
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
    const batchSize = 10; // Firestore 'in' queries support up to 10 IDs

    for (let i = 0; i < recipeIds.length; i += batchSize) {
      const batch = recipeIds.slice(i, i + batchSize);
      try {
        console.log("Fetching recipes for batch:", batch);
        const q = query(
          collection(db, 'AllRecipes'),
          where('__name__', 'in', batch)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((docSnapshot) => {
          recipes.push({ id: docSnapshot.id, ...docSnapshot.data() });
        });
      } catch (error) {
        console.error('Error fetching recipes:', error);
        Alert.alert('Error', 'Failed to fetch recipe data.');
      }
    }

    if (recipes.length === 0) {
      console.warn("No recipes data returned for the provided IDs.");
    } else {
      console.log('Fetched Recipes:', recipes);
    }

    return recipes;
  };

  // Function to aggregate nutritional data for the current week
  const aggregateWeeklyNutrition = async () => {
    if (!mealPlan) {
      console.warn('No meal plan available');
      return;
    }

    const { weekStart, weekEnd } = getCurrentWeekRange();

    let calories = 0;
    let protein = 0;
    let carbohydrates = 0;
    let fat = 0;

    const recipeIdsSet = new Set();

    // Iterate through each mealTime (e.g., breakfast, lunch, dinner) in the plan
    Object.keys(mealPlan).forEach((mealTime) => {
      const mealArray = mealPlan[mealTime];
      if (Array.isArray(mealArray)) {
        // Iterate over the array of meals
        mealArray.forEach((meal) => {
          // Parse the meal.date string into a Date object
          // Assuming meal.date is in 'YYYY-MM-DD' format
          const mealDate = parse(meal.date, 'yyyy-MM-dd', new Date());

          // Ensure the meal date is valid and falls within the current week's range
          if (
            isValid(mealDate) &&
            isWithinInterval(mealDate, { start: weekStart, end: weekEnd })
          ) {
            // Collect recipeIds from meals within the current week
            if (meal.recipeId) {
              recipeIdsSet.add(meal.recipeId);
            }
          } else {
            console.log(`Meal on ${meal.date} is outside the current week or invalid.`);
          }
        });
      }
    });

    const recipeIds = Array.from(recipeIdsSet);
    console.log('Recipe IDs within current week:', recipeIds);

    // Fetch recipes data from AllRecipes collection
    const recipesData = await fetchRecipesData(recipeIds);
    console.log('Recipes Data:', recipesData);

    // Create a map of recipeId to totalNutrition
    const recipeNutritionMap = {};
    recipesData.forEach((recipe) => {
      if (recipe.id && recipe.totalNutrition) {
        recipeNutritionMap[recipe.id] = recipe.totalNutrition;
      } else {
        console.warn(`No nutrition data found for recipe ID: ${recipe.id}`);
      }
    });

    // Sum up nutritional data for the week
    Object.keys(mealPlan).forEach((mealTime) => {
      const mealArray = mealPlan[mealTime];
      if (Array.isArray(mealArray)) {
        mealArray.forEach((meal) => {
          // Parse the meal.date string into a Date object
          const mealDate = parse(meal.date, 'yyyy-MM-dd', new Date());

          // Aggregate nutritional data for meals within the current week
          if (
            isValid(mealDate) &&
            isWithinInterval(mealDate, { start: weekStart, end: weekEnd })
          ) {
            const nutrition = recipeNutritionMap[meal.recipeId];
            if (nutrition) {
              calories += nutrition.calories || 0;
              protein += nutrition.protein || 0;
              carbohydrates += nutrition.carbohydrates || 0;
              fat += nutrition.fat || 0;
            } else {
              console.warn("No nutrition data found for recipe ID:", meal.recipeId);
            }
          }
        });
      }
    });

    // Round values to the nearest tenth
    calories = Math.round(calories * 10) / 10;
    protein = Math.round(protein * 10) / 10;
    carbohydrates = Math.round(carbohydrates * 10) / 10;
    fat = Math.round(fat * 10) / 10;

    console.log('Aggregated Nutrition:', { calories, protein, carbohydrates, fat });

    setTotalCalories(calories);
    setTotalProtein(protein);
    setTotalCarbohydrates(carbohydrates);
    setTotalFat(fat);
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
      aggregateWeeklyNutrition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealPlan]);

  if (authLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Please log in to view your nutrition data.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Weekly Nutrition Summary</Text>

      {/* Nutrition Progress Bars */}
      <View style={styles.nutritionRowContainer}>
        {/* Calories */}
        <View style={styles.nutritionItem}>
          <View style={styles.nutritionHeader}>
            <Text style={styles.nutritionLabel}>Calories</Text>
            <Text style={styles.nutritionValue}>{totalCalories} cal</Text>
          </View>
          <ProgressBar
            progress={
              totalCalories / WEEKLY_GOALS.calories > 1
                ? 1
                : totalCalories / WEEKLY_GOALS.calories
            }
            color={COLORS.calories}
            style={styles.progressBar}
          />
          <Text style={styles.goalText}>
            {totalCalories} / {WEEKLY_GOALS.calories} cal
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
              totalProtein / WEEKLY_GOALS.protein > 1
                ? 1
                : totalProtein / WEEKLY_GOALS.protein
            }
            color={COLORS.protein}
            style={styles.progressBar}
          />
          <Text style={styles.goalText}>
            {totalProtein} / {WEEKLY_GOALS.protein} g
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
              totalCarbohydrates / WEEKLY_GOALS.carbohydrates > 1
                ? 1
                : totalCarbohydrates / WEEKLY_GOALS.carbohydrates
            }
            color={COLORS.carbohydrates}
            style={styles.progressBar}
          />
          <Text style={styles.goalText}>
            {totalCarbohydrates} / {WEEKLY_GOALS.carbohydrates} g
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
              totalFat / WEEKLY_GOALS.fat > 1
                ? 1
                : totalFat / WEEKLY_GOALS.fat
            }
            color={COLORS.fat}
            style={styles.progressBar}
          />
          <Text style={styles.goalText}>
            {totalFat} / {WEEKLY_GOALS.fat} g
          </Text>
        </View>
      </View>
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
});

export default NutritionTracker;
