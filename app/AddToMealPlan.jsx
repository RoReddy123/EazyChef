// AddToMealPlan.jsx

import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../configs/FirebaseConfig'; // Ensure correct path
import { AntDesign } from '@expo/vector-icons';
import { AuthContext } from '../components/AuthProvider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

const ITEM_WIDTH = 160;
const ITEM_MARGIN = 10;

// Helper function to capitalize the first letter of a string
const capitalizeFirstLetter = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const AddToMealPlan = ({ mealType, onClose }) => {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { user } = useContext(AuthContext);

  useEffect(() => {
    const fetchRecipesByMealTime = async () => {
      try {
        const capitalizedMealType = capitalizeFirstLetter(mealType);
        console.log("Querying for mealType:", capitalizedMealType);

        const recipesRef = collection(db, 'AllRecipes');
        const q = query(recipesRef, where('mealTimes', 'array-contains', capitalizedMealType));
        const querySnapshot = await getDocs(q);
        const fetchedRecipes = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        console.log("Fetched Recipes:", fetchedRecipes);
        setRecipes(fetchedRecipes);
      } catch (err) {
        Alert.alert('Error', err.message);
      } finally {
        setLoading(false);
      }
    };

    if (mealType) {
      fetchRecipesByMealTime();
    }
  }, [mealType]);

  const onChangeDate = (event, selectedDateValue) => {
    setShowDatePicker(Platform.OS === 'ios'); // Keep picker open on iOS
    if (selectedDateValue) {
      setSelectedDate(selectedDateValue);
    }
  };

  const addMealToPlan = async () => {
    if (!selectedRecipe) {
      Alert.alert('No Recipe Selected', 'Please select a recipe to add.');
      return;
    }

    if (!mealType) {
      Alert.alert('Error', 'Meal type is undefined.');
      return;
    }

    try {
      const mealPlanDocRef = doc(db, 'MealPlans', user.uid);
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');

      const mealToAdd = {
        recipeId: selectedRecipe.id,
        title: selectedRecipe.title,         // Include title
        imageUrl: selectedRecipe.imageUrl,   // Include imageUrl
        date: formattedDate,
      };

      const mealPlanDoc = await getDoc(mealPlanDocRef);
      const mealField = mealType.toLowerCase();
      let updatedMealsArray = [];

      if (mealPlanDoc.exists()) {
        const currentData = mealPlanDoc.data();
        updatedMealsArray = currentData[mealField] || [];

        // Check if the same recipe is already added on the same date
        const duplicateMeal = updatedMealsArray.find(
          (meal) => meal.recipeId === selectedRecipe.id && meal.date === formattedDate
        );

        if (duplicateMeal) {
          Alert.alert('Duplicate Meal', 'This meal is already added for the selected date.');
          return;
        } else {
          updatedMealsArray.push(mealToAdd);
        }
      } else {
        // Document doesn't exist, create it with the meal added under the correct meal type
        updatedMealsArray = [mealToAdd];

        // Create the document with all meal categories initialized
        await setDoc(mealPlanDocRef, {
          breakfast: [],
          lunch: [],
          dinner: [],
          snack: [],
          dessert: [],
          [mealField]: updatedMealsArray, // Add the current meal under the appropriate meal type
        });
        Alert.alert('Success', `Meal added to ${capitalizeFirstLetter(mealType)} on ${formattedDate}`);
        onClose();
        return;
      }

      // If the document already exists, update the mealType field with the new array
      await updateDoc(mealPlanDocRef, {
        [mealField]: updatedMealsArray, // Update the specific meal type field
      });

      Alert.alert('Success', `Meal added to ${capitalizeFirstLetter(mealType)} on ${formattedDate}`);
      onClose();
    } catch (err) {
      console.error('Error adding meal to plan:', err);
      Alert.alert('Error', 'Failed to add meal to plan.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <AntDesign name="arrowleft" size={24} color="#007bff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add to Meal Plan</Text>
      </View>

      {/* Search Input */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search recipes..."
        value={searchQuery}
        onChangeText={(text) => setSearchQuery(text)}
      />

      {/* Recipes List */}
      <FlatList
        data={recipes.filter(recipe => recipe.title.toLowerCase().includes(searchQuery.toLowerCase()))}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelectedRecipe(item)} style={styles.recipeContainer}>
            <Image source={{ uri: item.imageUrl }} style={styles.image} />
            <Text style={styles.recipeTitle}>{item.title}</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
      />

      {/* Selected Recipe and Date Picker */}
      {selectedRecipe && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedText}>Selected Recipe: {selectedRecipe.title}</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
            <Text style={styles.dateButtonText}>Select Date</Text>
          </TouchableOpacity>
          <Text style={styles.selectedDateText}>Selected Date: {format(selectedDate, 'yyyy-MM-dd')}</Text>
          <TouchableOpacity onPress={addMealToPlan} style={styles.addButton}>
            <Text style={styles.addButtonText}>Add to Plan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* DateTimePicker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={onChangeDate}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    paddingRight: 10,
    marginVertical: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchInput: {
    marginVertical: 10,
    borderWidth: 1,
    padding: 8,
    borderRadius: 5,
  },
  recipeContainer: {
    width: ITEM_WIDTH,
    margin: ITEM_MARGIN,
    padding: 10,
    backgroundColor: '#f7f7f7',
    borderRadius: 10,
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 100,
    borderRadius: 10,
  },
  recipeTitle: {
    marginTop: 5,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  row: {
    justifyContent: 'space-between',
  },
  selectedContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  selectedText: {
    fontSize: 16,
    marginBottom: 10,
  },
  dateButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#007bff',
    borderRadius: 5,
  },
  dateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  selectedDateText: {
    marginTop: 10,
    fontSize: 16,
  },
  addButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#28a745',
    borderRadius: 5,
    width: '60%',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AddToMealPlan;
