import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import {
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'; // Import Firestore utilities
import { db } from '../../configs/FirebaseConfig';
import { format, addDays, subDays, isValid } from 'date-fns';
import { AuthContext } from './../AuthProvider';
import AddToMealPlan from '../../app/AddToMealPlan';
import RecipeModal from '../../app/RecipeModal'; // Import RecipeModal

const DailyMeals = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mealPlan, setMealPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState(null);

  const [recipeModalVisible, setRecipeModalVisible] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const [mealsByType, setMealsByType] = useState({
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
    dessert: [],
  });

  const { user, authLoading } = useContext(AuthContext);

  // Fetch meal plan data for the current day
  useEffect(() => {
    if (!user || authLoading) return;

    const fetchMealPlan = async () => {
      setLoading(true);
      try {
        const mealPlanDocRef = doc(db, 'MealPlans', user.uid);

        onSnapshot(mealPlanDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            setMealPlan(docSnapshot.data());
          } else {
            // Initialize the document if it doesn't exist
            setDoc(mealPlanDocRef, {
              breakfast: [],
              lunch: [],
              dinner: [],
              snack: [],
              dessert: [],
            });
            setMealPlan({
              breakfast: [],
              lunch: [],
              dinner: [],
              snack: [],
              dessert: [],
            });
          }
        });
      } catch (error) {
        console.error('Error fetching meal plan:', error);
        Alert.alert('Error', 'Failed to fetch meal plan.');
      } finally {
        setLoading(false);
      }
    };

    fetchMealPlan();
  }, [selectedDate, user, authLoading]);

  // Fetch meals whenever selectedDate or mealPlan changes
  useEffect(() => {
    const fetchMeals = async () => {
      if (!mealPlan) return;

      const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'];
      const updatedMeals = {};

      for (const mealType of mealTypes) {
        const meals = await getMealsForDayAndMeal(mealType);
        updatedMeals[mealType] = meals;
      }

      setMealsByType(updatedMeals);
    };

    fetchMeals();
  }, [selectedDate, mealPlan]);

  const formatDateKey = (date) => {
    if (!isValid(date)) {
      console.error('Invalid date:', date);
      return 'Invalid Date';
    }

    const today = new Date();
    const tomorrow = addDays(today, 1);
    const yesterday = subDays(today, 1);

    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return `Today, ${format(date, 'MMM d')}`;
    } else if (format(date, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd')) {
      return `Tomorrow, ${format(date, 'MMM d')}`;
    } else if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
      return `Yesterday, ${format(date, 'MMM d')}`;
    } else {
      return format(date, 'EEEE, MMM d, yyyy');
    }
  };

  const goToPreviousDay = () => {
    setSelectedDate((prevDate) => subDays(prevDate, 1));
  };

  const goToNextDay = () => {
    setSelectedDate((prevDate) => addDays(prevDate, 1));
  };

  const formatDateForFetching = (date) => format(date, 'yyyy-MM-dd');

  // Fetch recipe details from AllRecipes using recipeId
  const fetchRecipeById = async (recipeId) => {
    try {
      const recipeDocRef = doc(db, 'AllRecipes', recipeId);
      const recipeSnapshot = await getDoc(recipeDocRef);
      if (recipeSnapshot.exists()) {
        return recipeSnapshot.data(); // Return full recipe data
      } else {
        console.error(`Recipe with ID ${recipeId} not found`);
        return null;
      }
    } catch (error) {
      console.error('Error fetching recipe:', error);
      return null;
    }
  };

  // Get meals for the current day and meal type
  const getMealsForDayAndMeal = async (mealType) => {
    const formattedDateKey = formatDateForFetching(selectedDate);
    if (!mealPlan || !mealPlan[mealType]) return [];

    const mealsForTheDay = mealPlan[mealType].filter((meal) => meal.date === formattedDateKey);

    // Fetch recipe details for each meal
    const mealWithRecipes = await Promise.all(
      mealsForTheDay.map(async (meal) => {
        const fullRecipe = await fetchRecipeById(meal.recipeId);
        return fullRecipe ? { ...meal, ...fullRecipe } : meal;
      })
    );

    return mealWithRecipes;
  };

  const openAddMealModal = (mealType) => {
    setSelectedMealType(mealType);
    setModalVisible(true);
  };

  const openRecipeModal = async (meal) => {
    const fullRecipe = await fetchRecipeById(meal.recipeId); // Fetch recipe when a meal is clicked
    setSelectedRecipe(fullRecipe); // Set the full recipe in state
    setRecipeModalVisible(true); // Show modal
  };

  const closeRecipeModal = () => {
    setSelectedRecipe(null);
    setRecipeModalVisible(false);
  };

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Please log in to view your meal plan.</Text>
      </View>
    );
  }

  const dateKey = formatDateKey(selectedDate);

  return (
    <View style={styles.container}>
      {/* Date Navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={goToPreviousDay} accessible={true} accessibilityLabel="Previous Day">
          <AntDesign name="leftcircle" size={32} color="#007bff" />
        </TouchableOpacity>
        <Text style={styles.dateText}>{dateKey}</Text>
        <TouchableOpacity onPress={goToNextDay} accessible={true} accessibilityLabel="Next Day">
          <AntDesign name="rightcircle" size={32} color="#007bff" />
        </TouchableOpacity>
      </View>

      {/* Loading Indicator */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollViewContent}>
          {['breakfast', 'lunch', 'dinner', 'snack', 'dessert'].map((mealTime, index) => (
            <View
              key={mealTime}
              style={
                mealTime === 'breakfast'
                  ? styles.mealCategoryBreakfast // Rounded top corners for breakfast
                  : mealTime === 'dessert'
                  ? styles.mealCategoryDessert // Rounded bottom corners for dessert
                  : styles.mealCategory
              }
            >
              {/* Meal Header */}
              <View style={styles.mealHeader}>
                <Text style={styles.mealType}>{capitalizeFirstLetter(mealTime)}</Text>
                <TouchableOpacity
                  onPress={() => openAddMealModal(mealTime)}
                  accessible={true}
                  accessibilityLabel={`Add ${capitalizeFirstLetter(mealTime)}`}
                >
                  <AntDesign name="pluscircle" size={24} color="#007bff" />
                </TouchableOpacity>
              </View>

              {/* Meal Items */}
              {mealsByType[mealTime] && mealsByType[mealTime].length > 0 ? (
                mealsByType[mealTime].map((meal, mealIndex) => (
                  <TouchableOpacity
                    key={`${mealTime}_${mealIndex}`}
                    style={styles.mealItem}
                    onPress={() => openRecipeModal(meal)}
                    activeOpacity={0.7}
                    accessible={true}
                    accessibilityLabel={`View details for ${meal.title}`}
                  >
                    <Image source={{ uri: meal.imageUrl }} style={styles.mealImage} />
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealTitle}>{meal.title}</Text>
                      <Text style={styles.mealCalories}>{meal.calories} kcal</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noMealText}>No items added.</Text>
              )}

              {/* Separator line */}
              {index < 4 && <View style={styles.separatorLine} />}
            </View>
          ))}
        </ScrollView>
      )}

      {/* RecipeModal */}
      <RecipeModal
        visible={recipeModalVisible}
        onClose={closeRecipeModal}
        recipe={selectedRecipe}
      />

      {/* AddToMealPlan Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="overFullScreen"
      >
        <AddToMealPlan
          mealType={selectedMealType}
          onClose={() => setModalVisible(false)}
        />
      </Modal>
    </View>
  );
};

// Helper function to capitalize first letter
const capitalizeFirstLetter = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 10, backgroundColor: '#F0F8FF' },

  dateNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#D6E5F5',
    padding: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#ccc',
    marginTop: 20,
  },

  dateText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  scrollViewContent: {
    paddingBottom: 20,
  },

  // Meal category style with rounded top corners for breakfast
  mealCategoryBreakfast: {
    padding: 10,
    backgroundColor: '#D6E5F5',
  },

  // Meal category style with rounded bottom corners for dessert
  mealCategoryDessert: {
    padding: 10,
    backgroundColor: '#D6E5F5',
    borderBottomLeftRadius: 10, // Only bottom-left corner rounded
    borderBottomRightRadius: 10, // Only bottom-right corner rounded
  },

  mealCategory: {
    padding: 10,
    backgroundColor: '#D6E5F5',
  },

  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  mealType: {
    fontSize: 18,
    fontWeight: '600',
  },

  noMealText: {
    fontSize: 14,
    color: 'gray',
    marginTop: 5,
  },

  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    paddingHorizontal: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  mealImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 15,
    backgroundColor: '#e0e0e0',
  },

  mealInfo: {
    flex: 1,
    justifyContent: 'center',
  },

  mealTitle: {
    fontSize: 16,
    fontWeight: '500',
  },

  mealCalories: {
    fontSize: 14,
    color: '#555',
  },

  separatorLine: {
    height: 1,
    backgroundColor: '#ccc',
    marginTop: 10,
  },

  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default DailyMeals;
