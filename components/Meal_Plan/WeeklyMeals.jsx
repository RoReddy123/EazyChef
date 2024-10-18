import React, { useState, useEffect, useContext, useRef } from 'react';
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
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'; // Added getDoc
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
          } else {
            // Initialize the document if it doesn't exist
            await setDoc(mealPlanDocRef, {
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

  const formatDateKey = (date) => {
    if (!isValid(date)) {
      console.error("Invalid date:", date);
      return 'Invalid Date'; // Return a fallback value if the date is invalid
    }
    return format(date, 'yyyy-MM-dd'); // Return the formatted date
  };

  // Function to format date and show "Today," "Tomorrow," or "Yesterday" when applicable
  const formatDateForDisplay = (date) => {
    if (isToday(date)) {
      return `Today, ${format(date, 'MMM d')}`;
    } else if (isTomorrow(date)) {
      return `Tomorrow, ${format(date, 'MMM d')}`;
    } else if (isYesterday(date)) {
      return `Yesterday, ${format(date, 'MMM d')}`;
    } else {
      return format(date, 'EEEE, MMM d'); // Show day name for other dates
    }
  };

  const getCurrentWeek = (date) => {
    if (!isValid(date)) {
      console.error("Invalid selected date:", date);
      return [];
    }
    const start = startOfWeek(date, { weekStartsOn: 0 }); // Sunday as the first day of the week
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(addDays(start, i));
    }
    return week;
  };

  const goToPreviousWeek = () => {
    const previousWeek = subWeeks(selectedDate, 1);
    if (isValid(previousWeek)) {
      setSelectedDate(previousWeek); // Move back by one week
    } else {
      console.error("Invalid previous week:", previousWeek);
    }
  };

  const goToNextWeek = () => {
    const nextWeek = addWeeks(selectedDate, 1);
    if (isValid(nextWeek)) {
      setSelectedDate(nextWeek); // Move forward by one week
    } else {
      console.error("Invalid next week:", nextWeek);
    }
  };

  const scrollToToday = () => {
    const todayIndex = currentWeek.findIndex((date) => isValid(date) && format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'));
    if (todayIndex !== -1 && dayRefs.current[todayIndex]) {
      // Scroll to today's date within the current week
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

    // If today is within the current week, just scroll to it
    if (isSameWeek(today, selectedDate, { weekStartsOn: 0 })) {
      scrollToToday();
    } else {
      // If in a different week, update the week and then scroll to today
      setSelectedDate(today);
      const week = getCurrentWeek(today);
      setCurrentWeek(week);
      setTimeout(() => scrollToToday(), 100); // Ensure scroll happens after state update
    }
  };

  const openAddMealModal = (mealType, date) => {
    setSelectedMealType(mealType);
    setSelectedDateForMeal(date);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false); // Set modal visibility to false to close the modal
  };

  const filterMeals = (mealsArray, dateKey) => {
    return mealsArray.filter((meal) => meal.date === dateKey);
  };

  const getMealsForDayAndMeal = (mealType, dateKey) => {
    if (!mealPlan || !mealPlan[mealType]) return [];
    return filterMeals(mealPlan[mealType], dateKey);
  };

  // New functions to handle RecipeModal
  const openRecipeModal = async (meal) => {
    const fullRecipe = await fetchRecipeById(meal.recipeId); // Fetch recipe when a meal is clicked
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

  // **New Function: Fetch Recipe by ID**
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meal Plan</Text>
      </View>

      {/* Week Navigation */}
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

      {/* Loading Indicator */}
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
                ref={(el) => (dayRefs.current[index] = el)} // Assign refs to each day
              >
                {/* Updated date display to show Today, Tomorrow, Yesterday */}
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
                      getMealsForDayAndMeal(mealTime, dateKey).map((meal, index) => (
                        <TouchableOpacity
                          key={`${mealTime}_${meal.recipeId}_${meal.date}_${index}`}
                          style={styles.mealItem}
                          onPress={() => openRecipeModal(meal)}
                          accessible={true}
                          accessibilityLabel={`View details for ${meal.title}`}
                        >
                          <Image source={{ uri: meal.imageUrl }} style={styles.mealImage} />
                          <Text style={styles.mealTitle}>{meal.title}</Text>
                        </TouchableOpacity>
                      ))
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

      {/* Modal to add meals */}
      <Modal visible={modalVisible} animationType="slide">
        <AddToMealPlan mealType={selectedMealType} onClose={closeModal} />
      </Modal>

      {/* Recipe Modal */}
      <RecipeModal
        visible={recipeModalVisible}
        onClose={closeRecipeModal}
        recipe={selectedRecipe}
      />

      {/* Floating "Jump to Today" Button */}
      <TouchableOpacity style={styles.floatingButton} onPress={jumpToToday} accessible={true} accessibilityLabel="Jump to Today">
        <AntDesign name="calendar" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Grocery Button */}
      <TouchableOpacity
        style={styles.groceryButton}
        onPress={() => router.push('/GroceryList')} // Navigate to GroceryList
        accessible={true}
        accessibilityLabel="Go to Grocery List"
      >
        <MaterialIcons name="shopping-cart" size={24} color="#fff" />
        <Text style={styles.groceryButtonText}>Grocery</Text>
      </TouchableOpacity>
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
    paddingBottom: 100, // Ensure content is scrollable beneath floating buttons
  },
});

export default WeeklyMeals;
