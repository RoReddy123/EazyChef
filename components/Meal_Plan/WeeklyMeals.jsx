import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router'; // For navigation
import { AntDesign, MaterialIcons } from '@expo/vector-icons'; // For icons
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../configs/FirebaseConfig';
import {
  format,
  startOfWeek,
  addDays,
  subWeeks,
  addWeeks,
  isValid,
  isSameWeek,
  isToday,
  isTomorrow,
  isYesterday,
} from 'date-fns';
import AddToMealPlan from '../../app/AddToMealPlan'; // Ensure correct path
import { AuthContext } from './../AuthProvider'; // Adjust the path if necessary
import RecipeModal from '../../app/RecipeModal'; // Import the RecipeModal
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler'; // Import GestureHandlerRootView
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message'; // Import Toast

const WeeklyMeals = () => {
  const router = useRouter(); // Navigation hook
  const [selectedDate, setSelectedDate] = useState(new Date()); // Tracks the current week
  const [currentWeek, setCurrentWeek] = useState([]);
  const [mealPlan, setMealPlan] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [selectedDateForMeal, setSelectedDateForMeal] = useState(null);
  const [loading, setLoading] = useState(false);

  const { user, authLoading } = useContext(AuthContext);
  const scrollViewRef = useRef(null); // Reference for the ScrollView
  const dayRefs = useRef([]); // Array of refs for each day in the week

  // New state variables for RecipeModal
  const [recipeModalVisible, setRecipeModalVisible] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // State variables for Reschedule Modal
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [mealToReschedule, setMealToReschedule] = useState(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState(new Date());

  // State for Nutrition Totals
  const [nutritionTotals, setNutritionTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  });

  useEffect(() => {
    if (!user || authLoading) return;

    const week = getCurrentWeek(selectedDate);
    setCurrentWeek(week);

    const fetchMealPlan = async () => {
      setLoading(true);
      try {
        const mealPlanDocRef = doc(db, 'MealPlans', user.uid);

        onSnapshot(mealPlanDocRef, async (docSnapshot) => {
          if (docSnapshot.exists()) {
            setMealPlan(docSnapshot.data());
            setNutritionTotals(docSnapshot.data().nutritionTotals || {
              calories: 0,
              protein: 0,
              carbs: 0,
              fats: 0,
            });
          } else {
            // Initialize the document if it doesn't exist
            await setDoc(mealPlanDocRef, {
              breakfast: [],
              lunch: [],
              dinner: [],
              snack: [],
              dessert: [],
              nutritionTotals: {
                calories: 0,
                protein: 0,
                carbs: 0,
                fats: 0,
              },
            });
            setMealPlan({
              breakfast: [],
              lunch: [],
              dinner: [],
              snack: [],
              dessert: [],
              nutritionTotals: {
                calories: 0,
                protein: 0,
                carbs: 0,
                fats: 0,
              },
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

  const formatDateKey = (date) => {
    if (!isValid(date)) {
      console.error("Invalid date:", date);
      return 'Invalid Date';
    }
    return format(date, 'yyyy-MM-dd');
  };

  const formatDateForDisplay = (date) => {
    if (isToday(date)) {
      return `Today, ${format(date, 'MMM d')}`;
    } else if (isTomorrow(date)) {
      return `Tomorrow, ${format(date, 'MMM d')}`;
    } else if (isYesterday(date)) {
      return `Yesterday, ${format(date, 'MMM d')}`;
    } else {
      return format(date, 'EEEE, MMM d');
    }
  };

  const getCurrentWeek = (date) => {
    if (!isValid(date)) {
      console.error("Invalid selected date:", date);
      return [];
    }
    const start = startOfWeek(date, { weekStartsOn: 0 });
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(addDays(start, i));
    }
    return week;
  };

  const goToPreviousWeek = () => {
    const previousWeek = subWeeks(selectedDate, 1);
    if (isValid(previousWeek)) {
      setSelectedDate(previousWeek);
    } else {
      console.error("Invalid previous week:", previousWeek);
    }
  };

  const goToNextWeek = () => {
    const nextWeek = addWeeks(selectedDate, 1);
    if (isValid(nextWeek)) {
      setSelectedDate(nextWeek);
    } else {
      console.error("Invalid next week:", nextWeek);
    }
  };

  const scrollToToday = () => {
    const todayIndex = currentWeek.findIndex((date) => isValid(date) && format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'));
    if (todayIndex !== -1 && dayRefs.current[todayIndex]) {
      dayRefs.current[todayIndex].measureLayout(
        scrollViewRef.current,
        (x, y) => {
          scrollViewRef.current.scrollTo({ y: y, animated: true });
        }
      );
    }
  };

  const jumpToToday = () => {
    const today = new Date();
    if (isSameWeek(today, selectedDate, { weekStartsOn: 0 })) {
      scrollToToday();
    } else {
      setSelectedDate(today);
      const week = getCurrentWeek(today);
      setCurrentWeek(week);
      setTimeout(() => scrollToToday(), 100);
    }
  };

  const openAddMealModal = (mealType, date) => {
    setSelectedMealType(mealType);
    setSelectedDateForMeal(date);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const filterMeals = (mealsArray, dateKey) => {
    return mealsArray.filter((meal) => meal.date === dateKey);
  };

  const getMealsForDayAndMeal = (mealType, dateKey) => {
    if (!mealPlan || !mealPlan[mealType]) return [];
    return filterMeals(mealPlan[mealType], dateKey);
  };

  const openRecipeModal = async (meal) => {
    const fullRecipe = await fetchRecipeById(meal.recipeId);
    if (fullRecipe) {
      setSelectedRecipe(fullRecipe);
      setRecipeModalVisible(true);
    } else {
      Alert.alert('Error', 'Recipe details not found.');
    }
  };

  const closeRecipeModal = () => {
    setSelectedRecipe(null);
    setRecipeModalVisible(false);
  };

  const fetchRecipeById = async (recipeId) => {
    try {
      const recipeDocRef = doc(db, 'AllRecipes', recipeId);
      const recipeSnapshot = await getDoc(recipeDocRef);
      if (recipeSnapshot.exists()) {
        return recipeSnapshot.data();
      } else {
        console.error(`Recipe with ID ${recipeId} not found`);
        return null;
      }
    } catch (error) {
      console.error('Error fetching recipe:', error);
      return null;
    }
  };

  // **Use useCallback to memoize handler functions for performance**
  const handleDeleteMeal = useCallback(async (meal) => {
    if (!meal.mealType) {
      console.error('Meal type is undefined for meal:', meal);
      Alert.alert('Error', 'Cannot delete meal: Meal type is undefined.');
      return;
    }

    Alert.alert(
      'Delete Meal',
      `Are you sure you want to delete "${meal.title}" from your meal plan?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMeal(meal) },
      ]
    );
  }, [mealPlan, user]);

  const handleRescheduleMeal = useCallback((meal) => {
    if (!meal.mealType) {
      console.error('Meal type is undefined for meal:', meal);
      Alert.alert('Error', 'Cannot reschedule meal: Meal type is undefined.');
      return;
    }
    setMealToReschedule(meal);
    setRescheduleModalVisible(true);
  }, []);

  const deleteMeal = async (meal) => {
    try {
      const mealPlanDocRef = doc(db, 'MealPlans', user.uid);
      const updatedMealPlan = { ...mealPlan };
      if (!updatedMealPlan[meal.mealType]) {
        console.error(`Meal type "${meal.mealType}" does not exist in mealPlan.`);
        Alert.alert('Error', `Meal type "${meal.mealType}" does not exist.`);
        return;
      }

      updatedMealPlan[meal.mealType] = updatedMealPlan[meal.mealType].filter(
        (m) => !(m.recipeId === meal.recipeId && m.date === meal.date)
      );

      const recipe = await fetchRecipeById(meal.recipeId);
      if (recipe && recipe.nutrition) {
        updatedMealPlan.nutritionTotals = {
          calories: Math.max((updatedMealPlan.nutritionTotals.calories || 0) - (recipe.nutrition.calories || 0), 0),
          protein: Math.max((updatedMealPlan.nutritionTotals.protein || 0) - (recipe.nutrition.protein || 0), 0),
          carbs: Math.max((updatedMealPlan.nutritionTotals.carbs || 0) - (recipe.nutrition.carbs || 0), 0),
          fats: Math.max((updatedMealPlan.nutritionTotals.fats || 0) - (recipe.nutrition.fats || 0), 0),
        };
      }

      await setDoc(mealPlanDocRef, updatedMealPlan);
      Toast.show({
        type: 'success',
        text1: 'Meal Deleted',
        text2: `"${meal.title}" has been removed from your meal plan.`,
      });
    } catch (error) {
      console.error('Error deleting meal:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete the meal. Please try again.',
      });
    }
  };

  const rescheduleMeal = async (meal, newDate) => {
    try {
      const mealPlanDocRef = doc(db, 'MealPlans', user.uid);
      const updatedMealPlan = { ...mealPlan };

      if (!updatedMealPlan[meal.mealType]) {
        console.error(`Meal type "${meal.mealType}" does not exist in mealPlan.`);
        Alert.alert('Error', `Meal type "${meal.mealType}" does not exist.`);
        return;
      }

      // Remove the meal from the current date
      updatedMealPlan[meal.mealType] = updatedMealPlan[meal.mealType].filter(
        (m) => !(m.recipeId === meal.recipeId && m.date === meal.date)
      );

      // Add the meal to the new date
      const newMeal = { ...meal, date: newDate };
      updatedMealPlan[meal.mealType].push(newMeal);

      // No change to nutritionTotals since the meal is still in the plan

      await setDoc(mealPlanDocRef, updatedMealPlan);
      Toast.show({
        type: 'success',
        text1: 'Meal Rescheduled',
        text2: `"${meal.title}" has been moved to ${newDate}.`,
      });
    } catch (error) {
      console.error('Error rescheduling meal:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to reschedule the meal. Please try again.',
      });
    }
  };

  const onRescheduleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || newRescheduleDate;
    setNewRescheduleDate(currentDate);
  };

  const confirmReschedule = () => {
    if (isValid(newRescheduleDate)) {
      const formattedDate = format(newRescheduleDate, 'yyyy-MM-dd');
      rescheduleMeal(mealToReschedule, formattedDate);
      setRescheduleModalVisible(false);
      setMealToReschedule(null);
    } else {
      Alert.alert('Invalid Date', 'Please select a valid date.');
    }
  };

  // **Move renderRightActions inside the component and ensure it has access to handler functions**
  const renderRightActions = useCallback((progress, dragX, meal) => {
    return (
      <View style={styles.rightActionContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteMeal(meal)}
          accessible={true}
          accessibilityLabel={`Delete ${meal.title}`}
        >
          <AntDesign name="delete" size={24} color="#fff" />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rescheduleButton]}
          onPress={() => handleRescheduleMeal(meal)}
          accessible={true}
          accessibilityLabel={`Reschedule ${meal.title}`}
        >
          <MaterialIcons name="schedule" size={24} color="#fff" />
          <Text style={styles.actionText}>Reschedule</Text>
        </TouchableOpacity>
      </View>
    );
  }, [handleDeleteMeal, handleRescheduleMeal]);

  if (authLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      </GestureHandlerRootView>
    );
  }

  if (!user) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
          <Text style={styles.errorText}>Please log in to view your meal plan.</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Meal Plan</Text>
        </View>

        <View style={styles.weekNav}>
          <TouchableOpacity onPress={goToPreviousWeek} accessible={true} accessibilityLabel="Previous Week">
            <AntDesign name="leftcircle" size={32} color="#007bff" />
          </TouchableOpacity>
          <Text style={styles.weekText}>
            {isValid(currentWeek[0]) && isValid(currentWeek[6])
              ? `${format(currentWeek[0], 'MMM d')} - ${format(currentWeek[6], 'MMM d, yyyy')}`
              : 'Invalid Week'}
          </Text>
          <TouchableOpacity onPress={goToNextWeek} accessible={true} accessibilityLabel="Next Week">
            <AntDesign name="rightcircle" size={32} color="#007bff" />
          </TouchableOpacity>
        </View>

        <View style={styles.nutritionContainer}>
          <Text style={styles.nutritionHeader}>Weekly Nutrition Summary</Text>
          <View style={styles.nutritionRow}>
            <Text style={styles.nutritionLabel}>Calories:</Text>
            <Text style={styles.nutritionValue}>{nutritionTotals.calories || 0} kcal</Text>
          </View>
          <View style={styles.nutritionRow}>
            <Text style={styles.nutritionLabel}>Protein:</Text>
            <Text style={styles.nutritionValue}>{nutritionTotals.protein || 0} g</Text>
          </View>
          <View style={styles.nutritionRow}>
            <Text style={styles.nutritionLabel}>Carbs:</Text>
            <Text style={styles.nutritionValue}>{nutritionTotals.carbs || 0} g</Text>
          </View>
          <View style={styles.nutritionRow}>
            <Text style={styles.nutritionLabel}>Fats:</Text>
            <Text style={styles.nutritionValue}>{nutritionTotals.fats || 0} g</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
          </View>
        ) : (
          <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollViewContent}>
            {currentWeek.map((date, index) => {
              const dateKey = formatDateKey(date);
              return (
                <View
                  key={dateKey}
                  style={styles.dayContainer}
                  ref={(el) => (dayRefs.current[index] = el)}
                >
                  <Text style={styles.dateText}>{formatDateForDisplay(date)}</Text>

                  {['breakfast', 'lunch', 'dinner', 'snack', 'dessert'].map((mealTime) => (
                    <View key={mealTime} style={styles.mealCategory}>
                      <View style={styles.mealHeader}>
                        <Text style={styles.mealType}>{capitalizeFirstLetter(mealTime)}</Text>
                        <TouchableOpacity onPress={() => openAddMealModal(mealTime, dateKey)} accessible={true} accessibilityLabel={`Add ${capitalizeFirstLetter(mealTime)}`}>
                          <AntDesign name="pluscircle" size={24} color="#007bff" />
                        </TouchableOpacity>
                      </View>

                      {getMealsForDayAndMeal(mealTime, dateKey).length > 0 ? (
                        getMealsForDayAndMeal(mealTime, dateKey).map((meal, index) => {
                          // **Augment meal with mealType**
                          const mealWithType = { ...meal, mealType: mealTime };
                          return (
                            <Swipeable
                              key={`${mealTime}_${meal.recipeId}_${meal.date}_${index}`}
                              renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, mealWithType)}
                            >
                              <TouchableOpacity
                                style={styles.mealItem}
                                onPress={() => openRecipeModal(mealWithType)}
                                accessible={true}
                                accessibilityLabel={`View details for ${meal.title}`}
                              >
                                <Image source={{ uri: meal.imageUrl }} style={styles.mealImage} />
                                <Text style={styles.mealTitle}>{meal.title}</Text>
                              </TouchableOpacity>
                            </Swipeable>
                          );
                        })
                      ) : (
                        <Text style={styles.noMealText}>No items added.</Text>
                      )}
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        )}

        <Modal visible={modalVisible} animationType="slide">
          <AddToMealPlan mealType={selectedMealType} onClose={closeModal} />
        </Modal>

        <RecipeModal
          visible={recipeModalVisible}
          onClose={closeRecipeModal}
          recipe={selectedRecipe}
        />

        <Modal
          visible={rescheduleModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setRescheduleModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Reschedule "{mealToReschedule?.title}"</Text>
              <DateTimePicker
                value={newRescheduleDate}
                mode="date"
                display="default"
                onChange={onRescheduleDateChange}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setRescheduleModalVisible(false)}
                  accessible={true}
                  accessibilityLabel="Cancel Reschedule"
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={confirmReschedule}
                  accessible={true}
                  accessibilityLabel="Confirm Reschedule"
                >
                  <Text style={styles.modalButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <TouchableOpacity style={styles.floatingButton} onPress={jumpToToday} accessible={true} accessibilityLabel="Jump to Today">
          <AntDesign name="calendar" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.groceryButton}
          onPress={() => router.push('/GroceryList')}
          accessible={true}
          accessibilityLabel="Go to Grocery List"
        >
          <MaterialIcons name="shopping-cart" size={24} color="#fff" />
          <Text style={styles.groceryButtonText}>Grocery</Text>
        </TouchableOpacity>

        <Toast />
      </View>
    </GestureHandlerRootView>
  );
};

const capitalizeFirstLetter = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 10, backgroundColor: '#F0F8FF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  weekNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  weekText: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dayContainer: {
    marginBottom: 20,
    backgroundColor: '#fff',  // White background
    borderRadius: 10,         // Rounded corners
    padding: 15,
    shadowColor: '#000',      // Black shadow color
    shadowOffset: { width: 0, height: 0 },  // Equal offset in both directions for shadow all around
    shadowOpacity: 0.15,      // Slightly higher opacity for more visible shadow
    shadowRadius: 6,          // A larger radius to make the shadow soft and spread out
    elevation: 5,             // For Android: this adds a shadow around the element (higher elevation = more prominent shadow)
  },
  
  dateText: { fontSize: 20, fontWeight: '600', marginBottom: 10 },
  mealCategory: { padding: 10, marginTop: 10 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealType: { fontSize: 18, fontWeight: '600' },
  noMealText: { fontSize: 14, color: 'gray', paddingLeft: 10, marginTop: 5 },
  mealItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 5,
    backgroundColor: '#fff', // Set background to white
    padding: 10,              // Add padding inside the container
    borderRadius: 10,        // Rounded corners
    shadowColor: '#000',     // Shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,            // Shadow for Android
  },
  mealImage: { width: 60, height: 60, borderRadius: 10, marginRight: 10 },
  mealTitle: { fontSize: 16 },
  groceryButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#007bff',
    width: 150,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  groceryButtonText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 10,
    fontWeight: 'bold',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 100, // Adjust this value to position the button above the grocery button
    right: 30,
    backgroundColor: '#007bff',
    borderRadius: 50, // Make it round
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5, // For Android shadow effect
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  scrollViewContent: {
    paddingBottom: 200, // Ensure content is scrollable beneath floating buttons and nutrition summary
  },
  rightActionContainer: {
    flexDirection: 'row',
    width: 160,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 10,
  },
  actionButton: {
    width: 80,
    height: '80%',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  deleteButton: {
    backgroundColor: '#ff4d4d',
  },
  rescheduleButton: {
    backgroundColor: '#ffa500',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 10,
    marginHorizontal: 5,
    borderRadius: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  confirmButton: {
    backgroundColor: '#007bff',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  nutritionContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nutritionHeader: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  nutritionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  nutritionValue: {
    fontSize: 16,
  },
});

export default WeeklyMeals;
