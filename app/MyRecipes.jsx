import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  Button,
  Alert,
  ActivityIndicator,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import RNPickerSelect from 'react-native-picker-select';
import debounce from 'lodash.debounce';
import {
  collection,
  query,
  where,
  addDoc,
  serverTimestamp,
  doc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import BackArrow from '../components/BackArrow';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { auth, db, storage } from '../configs/FirebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { searchIngredients, getNutritionData } from '../services/USDAService';
import RecipeModal from './RecipeModal';

const { width } = Dimensions.get('window');

function MyRecipes() {
  const router = useRouter();
  const [pendingRecipes, setPendingRecipes] = useState([]);
  const [uploadedRecipes, setUploadedRecipes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newRecipeTitle, setNewRecipeTitle] = useState('');
  const [newRecipeDescription, setNewRecipeDescription] = useState('');
  const [newRecipeImage, setNewRecipeImage] = useState(null);
  const [newRecipeVideo, setNewRecipeVideo] = useState(null);
  const [newRecipeVideoThumbnail, setNewRecipeVideoThumbnail] = useState(null);
  const [newRecipeInstructions, setNewRecipeInstructions] = useState(['', '']);
  const [servingSize, setServingSize] = useState('');
  const [dietaryPreferences, setDietaryPreferences] = useState([]);
  const [ingredients, setIngredients] = useState([
    {
      description: '',
      quantity: '',
      unit: '',
      nutrition: { calories: 0, protein: 0, fat: 0, carbohydrates: 0 },
    },
  ]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMealTimes, setSelectedMealTimes] = useState([]);
  const [selectedCuisine, setSelectedCuisine] = useState('');
  const [activeTab, setActiveTab] = useState('under_review');
  const [recipeDescriptions, setRecipeDescriptions] = useState([]);
  const [currentRecipe, setCurrentRecipe] = useState(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState(null); // Store authenticated user

  // New States for Cooking Time and Recipe Difficulty
  const [cookingTimeHours, setCookingTimeHours] = useState('');
  const [cookingTimeMinutes, setCookingTimeMinutes] = useState('');
  const [recipeDifficulty, setRecipeDifficulty] = useState('');

  // New State for Total Nutrition
  const [totalNutrition, setTotalNutrition] = useState({
    calories: 0,
    protein: 0,
    fat: 0,
    carbohydrates: 0,
  });

  const MAX_DESCRIPTION_LENGTH = 100;

  const dietaryOptions = [
    'Vegetarian',
    'Vegan',
    'Dairy-free',
    'Nut-free',
    'Gluten-free',
    'Halal',
    'Kosher',
  ];
  const recipeDescriptionOptions = [
    'Organic',
    'Low carb',
    'High protein',
    'Low sugar',
    'Low fat',
    'High fiber',
    'Low sodium',
    'Sugar-free',
  ];

  const unitOptions = [
    { label: 'Grams', value: 'grams' },
    { label: 'Kilograms', value: 'kilograms' },
    { label: 'Liters', value: 'liters' },
    { label: 'Milliliters', value: 'milliliters' },
    { label: 'Cups', value: 'cups' },
    { label: 'Tablespoons', value: 'tablespoons' },
    { label: 'Teaspoons', value: 'teaspoons' },
    { label: 'Ounces', value: 'ounces' },
    { label: 'Pounds', value: 'pounds' },
  ];

  const categories = [
    { label: 'Appetizers', value: 'Appetizers' },
    { label: 'Small Bites', value: 'Small Bites' },
    { label: 'Quick Meals', value: 'Quick Meals' },
    { label: 'Main Meals', value: 'Main Meals' },
    { label: 'Vegetarian/Vegan', value: 'Vegetarian/Vegan' },
    { label: 'Party/Holiday', value: 'Party/Holiday' },
    { label: 'Desserts', value: 'Desserts' },
    { label: 'Refreshments', value: 'Refreshments' },
    { label: 'Cocktails', value: 'Cocktails' },
  ];

  const mealTimes = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack'];

  const cuisines = [
    { label: 'Italian', value: 'Italian' },
    { label: 'Mexican', value: 'Mexican' },
    { label: 'Chinese', value: 'Chinese' },
    { label: 'Indian', value: 'Indian' },
    { label: 'American', value: 'American' },
    { label: 'Japanese', value: 'Japanese' },
    { label: 'Mediterranean', value: 'Mediterranean' },
    { label: 'French', value: 'French' },
    { label: 'Thai', value: 'Thai' },
  ];

  // States for Ingredient Search
  const [focusedIngredientIndex, setFocusedIngredientIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [apiLimitReached, setApiLimitReached] = useState(false);

  // Listen for authentication state changes and store the user
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (authenticatedUser) => {
      if (authenticatedUser) {
        console.log(`User is authenticated with UID: ${authenticatedUser.uid}`);
        setUser(authenticatedUser); // Store authenticated user
        fetchRecipes(authenticatedUser.uid);
      } else {
        console.log('No user is signed in.');
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  // Fetch recipes for the authenticated user
  const fetchRecipes = (uid) => {
    const queryUserRecipes = query(
      collection(db, 'UserRecipes'),
      where('userId', '==', uid),
      where('status', 'in', ['pending', 'approved'])
    );

    const unsubscribeRecipes = onSnapshot(
      queryUserRecipes,
      (snapshot) => {
        const fetchedPendingRecipes = [];
        const fetchedUploadedRecipes = [];

        snapshot.forEach((docSnapshot) => {
          const recipeData = docSnapshot.data();
          const recipeId = docSnapshot.id;

          if (recipeData.status === 'pending') {
            fetchedPendingRecipes.push({ ...recipeData, id: recipeId });
          } else if (recipeData.status === 'approved') {
            fetchedUploadedRecipes.push({ ...recipeData, id: recipeId });

            if (!recipeData.copiedToAllRecipes) {
              transferRecipeToAllRecipes(recipeId, recipeData);
            }
          }
        });

        setPendingRecipes(fetchedPendingRecipes);
        setUploadedRecipes(fetchedUploadedRecipes);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching recipes:', error);
        Alert.alert('Firestore Error', 'Failed to fetch recipes.');
        setLoading(false);
      }
    );

    return unsubscribeRecipes;
  };

  /**
   * Function to transfer an approved recipe to AllRecipes collection
   * @param {string} recipeId - The ID of the recipe in UserRecipes
   * @param {object} recipeData - The data of the recipe
   */
  const transferRecipeToAllRecipes = async (recipeId, recipeData) => {
    if (recipeData.copiedToAllRecipes) {
      console.log(`Recipe ${recipeId} already copied to AllRecipes.`);
      return;
    }

    try {
      const validRecipeData = {
        title: recipeData.title || 'Untitled Recipe',
        description: recipeData.description || '',
        imageUrl: recipeData.imageUrl || '',
        videoUrl: recipeData.videoUrl || '',
        instructions: recipeData.instructions || [],
        servingSize: recipeData.servingSize || '',
        dietaryPreferences: recipeData.dietaryPreferences || [],
        recipeDescriptions: recipeData.recipeDescriptions || [],
        ingredients: recipeData.ingredients || [],
        category: recipeData.category || 'Uncategorized',
        mealTimes: recipeData.mealTimes || [],
        cuisine: recipeData.cuisine || 'Not Specified',
        cookingTime: recipeData.cookingTime || '',
        recipeDifficulty: recipeData.recipeDifficulty || '',
        totalNutrition: recipeData.totalNutrition || {
          calories: 0,
          protein: 0,
          fat: 0,
          carbohydrates: 0,
        },
        createdAt: recipeData.createdAt || serverTimestamp(),
        userId: recipeData.userId || 'Unknown User', // Include userId
      };

      console.log(`Transferring recipe ${recipeId} to AllRecipes.`);

      // Add to AllRecipes collection
      const allRecipesRef = collection(db, 'AllRecipes');
      const newAllRecipeRef = await addDoc(allRecipesRef, validRecipeData);
      console.log(`Recipe transferred with AllRecipes ID: ${newAllRecipeRef.id}`);

      // Update copiedToAllRecipes flag in UserRecipes
      const userRecipeRef = doc(db, 'UserRecipes', recipeId);
      await updateDoc(userRecipeRef, {
        copiedToAllRecipes: true,
      });

      console.log(`Updated UserRecipes ID: ${recipeId} with copiedToAllRecipes: true`);
    } catch (error) {
      console.error('Error transferring recipe:', error);
      Alert.alert('Transfer Error', `Failed to transfer the recipe: ${error.message}`);
    }
  };

  // Check and request permissions
  const checkPermissions = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'You need to grant permission to access the media library.');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking or requesting permissions:', error);
      Alert.alert('Permission Error', 'Failed to check or request media library permissions.');
      return false;
    }
  };

  // Function to pick an image
  const pickImage = async () => {
    try {
      const hasPermission = await checkPermissions();
      if (!hasPermission) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // Image selection only
        allowsEditing: true, // Allow editing
        aspect: [4, 3], // Adjust aspect ratio as per your requirements
        quality: 0.5, // Compress quality to reduce file size
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setNewRecipeImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'An error occurred while trying to pick an image.');
    }
  };

  const pickVideo = async () => {
    try {
      const hasPermission = await checkPermissions();
      if (!hasPermission) return;
  
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos, // Video selection only
        allowsEditing: true, // Allow editing
        quality: 0.7, // Adjust video quality/compression as needed
      });
  
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const videoUri = result.assets[0].uri;
  
        // Check the video duration
        const duration = await getVideoDuration(videoUri);
  
        if (duration > 90) {
          Alert.alert('Video Too Long', 'Please select a video that is 90 seconds or less.');
          return; // Do not proceed if the video is longer than 90 seconds
        }
  
        // Proceed with setting the video and generating the thumbnail
        setNewRecipeVideo(videoUri);
        generateThumbnail(videoUri);
      }
    } catch (error) {
      console.error('Error selecting video:', error);
      Alert.alert('Error', 'An error occurred while trying to pick a video.');
    }
  };
  
  // Function to get the video duration in seconds
  const getVideoDuration = async (uri) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      const status = await sound.getStatusAsync();
      const durationMillis = status.durationMillis;
      await sound.unloadAsync(); // Unload the sound to free up resources
      return durationMillis / 1000; // Convert milliseconds to seconds
    } catch (error) {
      console.error('Error getting video duration:', error);
      return 0; // Return 0 in case of an error
    }
  };  

  const generateThumbnail = async (videoUri) => {
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 1000, // 1 second into the video
      });
      setNewRecipeVideoThumbnail(uri);
    } catch (e) {
      console.warn('Error generating thumbnail:', e);
      Alert.alert('Error', 'Failed to generate video thumbnail.');
    }
  };
  

  /**
   * Function to upload an image to Firebase Storage
   * @param {string} uri - The local URI of the image
   * @param {function} progressCallback - Callback to track upload progress
   * @returns {string|null} - The download URL of the uploaded image or null if failed
   */
  const uploadImageAsync = async (uri, progressCallback) => {
    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(uri);
      const blob = await response.blob();

      const storageRef = ref(storage, `images/${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Monitor progress
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressCallback(progress);
            console.log(`Image upload is ${progress}% done`);
          },
          (error) => {
            console.error('Upload error:', error);
            Alert.alert('Upload Error', 'Failed to upload image.');
            reject(error);
          },
          async () => {
            blob.close && blob.close();
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('Image Download URL obtained:', downloadURL);
            resolve(downloadURL);
          }
        );
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Error', 'Failed to upload image.');
      return null;
    }
  };

  /**
   * Function to upload a video to Firebase Storage
   * @param {string} uri - The local URI of the video
   * @param {function} progressCallback - Callback to track upload progress
   * @returns {string|null} - The download URL of the uploaded video or null if failed
   */
  const uploadVideoAsync = async (uri, progressCallback) => {
    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error('User not authenticated');
      }

      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () {
          resolve(xhr.response);
        };
        xhr.onerror = function (e) {
          console.error('XHR error', e);
          reject(new TypeError('Network request failed'));
        };
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
      });

      const storageRef = ref(storage, `videos/${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Monitor progress
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressCallback(progress);
            console.log(`Video upload is ${progress}% done`);
          },
          (error) => {
            console.error('Upload error:', error);
            Alert.alert('Upload Error', 'Failed to upload video.');
            reject(error);
          },
          async () => {
            blob.close && blob.close();
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('Video Download URL obtained:', downloadURL);
            resolve(downloadURL);
          }
        );
      });
    } catch (error) {
      console.error('Error uploading video:', error);
      Alert.alert('Upload Error', 'Failed to upload video.');
      return null;
    }
  };

  const addInstructionLine = () => {
    setNewRecipeInstructions([...newRecipeInstructions, '']);
  };

  const handleInstructionChange = (text, index) => {
    const updatedInstructions = [...newRecipeInstructions];
    updatedInstructions[index] = text;
    setNewRecipeInstructions(updatedInstructions);
  };

  const addIngredient = () => {
    setIngredients([
      ...ingredients,
      {
        description: '',
        quantity: '',
        unit: '',
        nutrition: { calories: 0, protein: 0, fat: 0, carbohydrates: 0 },
      },
    ]);
  };

  /**
   * Function to handle changes in ingredient fields
   * @param {string} text - The input text
   * @param {number} index - The index of the ingredient in the array
   * @param {string} field - The field being updated ('description', 'quantity', or 'unit')
   */
  const handleIngredientChange = async (text, index, field) => {
    const updatedIngredients = [...ingredients];
    updatedIngredients[index][field] = text;
    setIngredients(updatedIngredients);

    if (
      field === 'quantity' ||
      field === 'unit' ||
      (field === 'description' && updatedIngredients[index].description)
    ) {
      const { description, quantity, unit } = updatedIngredients[index];
      if (description && quantity && unit) {
        if (apiLimitReached) {
          // Skip fetching nutrition data if API limit is reached
          Alert.alert(
            'API Limit Reached',
            'Cannot fetch nutrition data as the daily API limit has been reached.'
          );
          // Optionally, set nutrition to null or default values
          updatedIngredients[index].nutrition = { calories: 0, protein: 0, fat: 0, carbohydrates: 0 };
          setIngredients([...updatedIngredients]);
          calculateTotalNutrition([...updatedIngredients]);
          return;
        }

        try {
          const parsedQuantity = parseFloat(quantity);
          if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
            return;
          }

          const nutrition = await getNutritionData(description, parsedQuantity, unit);
          updatedIngredients[index].nutrition = nutrition;
          setIngredients([...updatedIngredients]);

          // Log individual ingredient nutrition to the console
          console.log(`Nutrition for ${description}:`, nutrition);

          calculateTotalNutrition([...updatedIngredients]);
        } catch (error) {
          // Check if the error is due to API rate limit
          if (error.message && error.message.toLowerCase().includes('limit')) {
            setApiLimitReached(true);
            Alert.alert(
              'API Limit Reached',
              'You have reached the daily limit for ingredient searches. Nutrition data is now unavailable.'
            );
          } else if (error.message && error.message.toLowerCase().includes('ingredient not found')) {
            Alert.alert('Ingredient Not Found', 'The ingredient you entered was not found.');
          } else {
            Alert.alert('Nutrition Data Error', error.message || 'Failed to fetch nutrition data.');
          }
          console.error('Error fetching nutrition data:', error);

          // Reset nutrition data if an error occurs
          updatedIngredients[index].nutrition = { calories: 0, protein: 0, fat: 0, carbohydrates: 0 };
          setIngredients([...updatedIngredients]);
          calculateTotalNutrition([...updatedIngredients]);
        }
      } else {
        // If any of the fields are missing, reset nutrition
        updatedIngredients[index].nutrition = { calories: 0, protein: 0, fat: 0, carbohydrates: 0 };
        setIngredients([...updatedIngredients]);

        // Log that nutrition data has been reset
        console.log(`Nutrition for ingredient at index ${index} has been reset.`);

        calculateTotalNutrition([...updatedIngredients]);
      }
    }
  };

  /**
   * Function to calculate total nutrition from all ingredients
   * @param {Array} ingredientsList - The list of ingredients
   */
  const calculateTotalNutrition = (ingredientsList) => {
    const total = {
      calories: 0,
      protein: 0,
      fat: 0,
      carbohydrates: 0,
    };

    ingredientsList.forEach((ingredient) => {
      if (ingredient.nutrition) {
        total.calories += ingredient.nutrition.calories || 0;
        total.protein += ingredient.nutrition.protein || 0;
        total.fat += ingredient.nutrition.fat || 0;
        total.carbohydrates += ingredient.nutrition.carbohydrates || 0;
      }
    });

    setTotalNutrition(total);

    // Log total nutrition to the console
    console.log('Total Nutrition:', total);
  };

  const toggleDietaryPreference = (preference) => {
    if (dietaryPreferences.includes(preference)) {
      setDietaryPreferences(dietaryPreferences.filter((item) => item !== preference));
    } else {
      setDietaryPreferences([...dietaryPreferences, preference]);
    }
  };

  const toggleRecipeDescription = (description) => {
    if (recipeDescriptions.includes(description)) {
      setRecipeDescriptions(recipeDescriptions.filter((item) => item !== description));
    } else {
      setRecipeDescriptions([...recipeDescriptions, description]);
    }
  };

  const toggleMealTime = (mealTime) => {
    if (selectedMealTimes.includes(mealTime)) {
      setSelectedMealTimes(selectedMealTimes.filter((time) => time !== mealTime));
    } else {
      if (mealTime === 'Lunch' || mealTime === 'Dinner') {
        // Group Lunch and Dinner together
        setSelectedMealTimes(['Lunch', 'Dinner']);
      } else {
        setSelectedMealTimes([mealTime]);
      }
    }
  };

  /**
   * Function to handle adding a new recipe
   */
  const handleAddRecipe = async () => {
    // Validate required fields
    if (
      !newRecipeTitle ||
      !newRecipeDescription ||
      !servingSize ||
      !newRecipeInstructions.some((instr) => instr.trim() !== '') ||
      !selectedCategory ||
      selectedMealTimes.length === 0 ||
      !selectedCuisine ||
      (!cookingTimeHours && !cookingTimeMinutes) ||
      !recipeDifficulty
    ) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    try {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert('Authentication Error', 'User not authenticated.');
        setIsSubmitting(false);
        return;
      }

      // Combine cooking time
      let combinedCookingTime = '';
      if (cookingTimeHours) {
        combinedCookingTime += `${cookingTimeHours} hour${cookingTimeHours > 1 ? 's' : ''}`;
      }
      if (cookingTimeMinutes) {
        if (combinedCookingTime) combinedCookingTime += ' and ';
        combinedCookingTime += `${cookingTimeMinutes} minute${cookingTimeMinutes > 1 ? 's' : ''}`;
      }

      // Upload image if selected
      let uploadedImageUrl = '';
      if (newRecipeImage) {
        // Resize image to reduce memory usage
        const manipResult = await ImageManipulator.manipulateAsync(
          newRecipeImage,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        uploadedImageUrl = await uploadImageAsync(manipResult.uri, setUploadProgress);
        if (!uploadedImageUrl) {
          throw new Error('Image upload failed.');
        }
      }

      // Upload video if selected
      let uploadedVideoUrl = '';
      if (newRecipeVideo) {
        uploadedVideoUrl = await uploadVideoAsync(newRecipeVideo, setUploadProgress);
        if (!uploadedVideoUrl) {
          throw new Error('Video upload failed.');
        }
      }

      // Calculate total nutrition (already calculated in state)
      const totalNutritionCalculated = { ...totalNutrition };

      // Log total nutrition before storing
      console.log('Total Nutrition to be stored:', totalNutritionCalculated);

      await addDoc(collection(db, 'UserRecipes'), {
        title: newRecipeTitle,
        description: newRecipeDescription,
        imageUrl: uploadedImageUrl,
        videoUrl: uploadedVideoUrl,
        instructions: newRecipeInstructions.filter((instr) => instr.trim() !== ''),
        servingSize,
        dietaryPreferences,
        recipeDescriptions,
        ingredients: ingredients.filter((ing) => ing.description.trim() !== ''),
        category: selectedCategory,
        mealTimes: selectedMealTimes,
        cuisine: selectedCuisine,
        cookingTime: combinedCookingTime,
        recipeDifficulty,
        userId: user.uid,
        status: 'pending',
        copiedToAllRecipes: false,
        createdAt: serverTimestamp(),
        totalNutrition: totalNutritionCalculated, // Add total nutrition here
      });
      Alert.alert('Success', 'Recipe submitted for approval!');
      setModalVisible(false);
      resetForm();
    } catch (error) {
      Alert.alert('Submission Error', `Error submitting recipe: ${error.message}`);
      console.error('Error adding document:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Function to reset the recipe addition form
   */
  const resetForm = () => {
    setNewRecipeTitle('');
    setNewRecipeDescription('');
    setNewRecipeImage(null);
    setNewRecipeVideo(null);
    setNewRecipeVideoThumbnail(null);
    setNewRecipeInstructions(['', '']);
    setServingSize('');
    setDietaryPreferences([]);
    setRecipeDescriptions([]);
    setIngredients([
      {
        description: '',
        quantity: '',
        unit: '',
        nutrition: { calories: 0, protein: 0, fat: 0, carbohydrates: 0 },
      },
    ]);
    setSelectedCategory('');
    setSelectedMealTimes([]);
    setSelectedCuisine('');
    setCookingTimeHours('');
    setCookingTimeMinutes('');
    setRecipeDifficulty('');
    setFocusedIngredientIndex(null);
    setSearchQuery('');
    setSearchResults([]);
    setTotalNutrition({
      calories: 0,
      protein: 0,
      fat: 0,
      carbohydrates: 0,
    });
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.length < 2 || apiLimitReached) {
        setSearchResults([]);
        return;
      }
      try {
        setSearchLoading(true);
        const results = await searchIngredients(query);
        // Ensure that results is an array. If not, set it to an empty array.
        setSearchResults(Array.isArray(results) ? results : []);
      } catch (error) {
        // Check if the error is due to API rate limit
        if (error.message && error.message.toLowerCase().includes('limit')) {
          setApiLimitReached(true);
          Alert.alert(
            'API Limit Reached',
            'You have reached the daily limit for ingredient searches. Please try again tomorrow.'
          );
        } else {
          Alert.alert('Error', error.message || 'An unexpected error occurred.');
        }
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500),
    [apiLimitReached]
  );

  /**
   * Function to handle changes in the ingredient search query
   * @param {string} text - The search query text
   * @param {number} index - The index of the ingredient being edited
   */
  const handleQueryChange = (text, index) => {
    setSearchQuery(text);
    setFocusedIngredientIndex(index);
    debouncedSearch(text);
  };

  /**
   * Function to handle selecting a search suggestion for an ingredient
   * @param {object} suggestion - The selected ingredient suggestion
   */
  const handleSelectSuggestion = async (suggestion) => {
    if (focusedIngredientIndex === null) return;
    const updatedIngredients = [...ingredients];
    updatedIngredients[focusedIngredientIndex].description = suggestion.description || ''; // Ensure it's a string
    setIngredients(updatedIngredients);
    setSearchResults([]);
    setSearchQuery('');
    setFocusedIngredientIndex(null);
    Keyboard.dismiss();

    // Fetch nutrition data for the selected ingredient
    try {
      const quantity = parseFloat(updatedIngredients[focusedIngredientIndex].quantity) || 1;
      const unit = updatedIngredients[focusedIngredientIndex].unit || 'grams';
      const nutrition = await getNutritionData(suggestion.description, quantity, unit) || {
        calories: 0,
        protein: 0,
        fat: 0,
        carbohydrates: 0,
      };
      updatedIngredients[focusedIngredientIndex].nutrition = nutrition;
      setIngredients([...updatedIngredients]);

      // Log individual ingredient nutrition to the console
      console.log(`Nutrition for ${suggestion.description}:`, nutrition);

      calculateTotalNutrition([...updatedIngredients]);
    } catch (error) {
      Alert.alert('Nutrition Data Error', 'Failed to fetch nutrition data for the selected ingredient.');
      console.error('Error fetching nutrition data:', error);
    }
  };

  /**
   * Function to render the recipe addition modal
   */
  const renderModalContent = () => (
    <ScrollView
      style={styles.formContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        onPress={() => {
          setModalVisible(false);
          resetForm();
        }}
        style={styles.closeButton}
      >
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Add New Recipe</Text>

      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        placeholder="Recipe Title"
        value={newRecipeTitle}
        onChangeText={setNewRecipeTitle}
      />

      <Text style={styles.label}>Description *</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Recipe Description"
        value={newRecipeDescription}
        onChangeText={(text) => {
          if (text.length <= MAX_DESCRIPTION_LENGTH) {
            setNewRecipeDescription(text);
          }
        }}
        multiline
      />
      <Text style={styles.charCount}>
        {newRecipeDescription.length}/{MAX_DESCRIPTION_LENGTH}
      </Text>

      <Text style={styles.label}>Image *</Text>
      <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
        {newRecipeImage ? (
          <Image source={{ uri: newRecipeImage }} style={styles.previewImage} />
        ) : (
          <Text style={styles.plusSign}>+</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Video *</Text>
      <TouchableOpacity style={styles.uploadBox} onPress={pickVideo}>
        {newRecipeVideoThumbnail ? (
          <Image source={{ uri: newRecipeVideoThumbnail }} style={styles.previewImage} />
        ) : (
          <Text style={styles.plusSign}>+</Text>
        )}
      </TouchableOpacity>


      {(isSubmitting || uploadProgress > 0) && (
        <View style={styles.progressContainer}>
          <Text>Uploading: {Math.round(uploadProgress)}%</Text>
          {/* Optional: Add a progress bar here */}
        </View>
      )}

      {/* Serving Size Input */}
      <Text style={styles.label}>Serving Size *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 4 servings"
        value={servingSize}
        onChangeText={setServingSize}
        keyboardType="default"
      />

      {/* Cooking Time Inputs */}
      <Text style={styles.label}>How long does your recipe take to cook? *</Text>
      <View style={styles.cookingTimeContainer}>
        <View style={styles.cookingTimeInputContainer}>
          <TextInput
            style={styles.cookingTimeInput}
            placeholder="Hours"
            value={cookingTimeHours}
            onChangeText={setCookingTimeHours}
            keyboardType="numeric"
          />
          <Text style={styles.cookingTimeLabel}>Hours</Text>
        </View>
        <View style={styles.cookingTimeInputContainer}>
          <TextInput
            style={styles.cookingTimeInput}
            placeholder="Minutes"
            value={cookingTimeMinutes}
            onChangeText={setCookingTimeMinutes}
            keyboardType="numeric"
          />
          <Text style={styles.cookingTimeLabel}>Minutes</Text>
        </View>
      </View>

      {/* Recipe Difficulty Picker */}
      <Text style={styles.label}>Rate the recipe difficulty *</Text>
      <RNPickerSelect
        style={pickerSelectStyles}
        placeholder={{ label: 'Select Difficulty', value: '' }}
        items={[
          { label: 'Easy', value: 'Easy' },
          { label: 'Medium', value: 'Medium' },
          { label: 'Hard', value: 'Hard' },
        ]}
        value={recipeDifficulty}
        onValueChange={setRecipeDifficulty}
      />

      {/* Ingredients Section with Search Suggestions */}
      <Text style={styles.label}>Ingredients</Text>
      {ingredients.map((ingredient, index) => (
        <View
          key={index}
          style={[
            styles.ingredientRow,
            focusedIngredientIndex === index ? { zIndex: 2 } : { zIndex: 1 },
          ]}
        >
          {/* Ingredient Name with Search Suggestions */}
          <View style={{ flex: 2, position: 'relative' }}>
            <TextInput
              style={styles.ingredientInput}
              placeholder="description"
              value={ingredient.description}
              onChangeText={(text) => {
                handleIngredientChange(text, index, 'description');
                handleQueryChange(text, index);
              }}
              onFocus={() => setFocusedIngredientIndex(index)}
              onBlur={() => {
                if (focusedIngredientIndex === index) {
                  setFocusedIngredientIndex(null);
                  setSearchResults([]);
                }
              }}
            />
            {focusedIngredientIndex !== null && Array.isArray(searchResults) && searchResults.length > 0 && (
              <TouchableWithoutFeedback onPress={() => setFocusedIngredientIndex(null)}>
                <View style={styles.suggestionsContainer}>
                  {searchLoading ? (
                    <ActivityIndicator size="small" color="#007bff" />
                  ) : (
                    <ScrollView
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled={true}
                    >
                      {searchResults.map((item) => (
                        <TouchableOpacity
                          key={item.fdcId.toString()}
                          onPress={() => handleSelectSuggestion(item)}
                          style={styles.suggestionItem}
                        >
                          <Text>{item.description ? String(item.description) : 'Unknown Ingredient'}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </TouchableWithoutFeedback>
            )}
          </View>

          <TextInput
            style={styles.quantityInput}
            placeholder="Qty"
            value={ingredient.quantity}
            onChangeText={(text) => handleIngredientChange(text, index, 'quantity')}
            keyboardType="numeric"
          />
          <RNPickerSelect
            style={pickerSelectStyles}
            placeholder={{ label: 'Unit', value: '' }}
            items={unitOptions}
            value={ingredient.unit}
            onValueChange={(value) => handleIngredientChange(value, index, 'unit')}
            disabled={apiLimitReached} // Disable picker if API limit is reached
          />
        </View>
      ))}
      <Button title="Add Ingredient" onPress={addIngredient} disabled={apiLimitReached} />
      {apiLimitReached && (
        <View style={styles.apiLimitBanner}>
          <Text style={styles.apiLimitBannerText}>
            Ingredient suggestions are unavailable today due to API limits. You can still enter ingredients manually.
          </Text>
        </View>
      )}

      {/* Instructions Section */}
      <Text style={styles.label}>Instructions *</Text>
      {newRecipeInstructions.map((instruction, index) => (
        <TextInput
          key={index}
          style={styles.textArea}
          placeholder={`Step ${index + 1}`}
          value={instruction}
          onChangeText={(text) => handleInstructionChange(text, index)}
          multiline
        />
      ))}
      <Button title="Add Step" onPress={addInstructionLine} />

      {/* Category Picker */}
      <Text style={styles.label}>Category *</Text>
      <RNPickerSelect
        style={pickerSelectStyles}
        placeholder={{ label: 'Select Category', value: '' }}
        items={categories}
        value={selectedCategory}
        onValueChange={setSelectedCategory}
      />

      {/* Meal Times Toggle Buttons */}
      <Text style={styles.label}>Meal Times *</Text>
      <View style={styles.mealTimeOptions}>
        {mealTimes.map((mealTime) => (
          <TouchableOpacity
            key={mealTime}
            style={[
              styles.mealTimeButton,
              selectedMealTimes.includes(mealTime) && styles.mealTimeButtonSelected,
            ]}
            onPress={() => toggleMealTime(mealTime)}
          >
            <Text
              style={
                selectedMealTimes.includes(mealTime)
                  ? styles.mealTimeButtonTextSelected
                  : styles.mealTimeButtonText
              }
            >
              {mealTime}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cuisine Picker */}
      <Text style={styles.label}>Cuisine *</Text>
      <RNPickerSelect
        style={pickerSelectStyles}
        placeholder={{ label: 'Select Cuisine', value: '' }}
        items={cuisines}
        value={selectedCuisine}
        onValueChange={setSelectedCuisine}
      />

      {/* Dietary Preferences Toggle Buttons */}
      <Text style={styles.label}>Dietary Preferences</Text>
      <View style={styles.optionsContainer}>
        {dietaryOptions.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionButton,
              dietaryPreferences.includes(option) && styles.optionButtonSelected,
            ]}
            onPress={() => toggleDietaryPreference(option)}
          >
            <Text
              style={
                dietaryPreferences.includes(option)
                  ? styles.optionButtonTextSelected
                  : styles.optionButtonText
              }
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recipe Descriptions Toggle Buttons */}
      <Text style={styles.label}>Recipe Descriptions</Text>
      <View style={styles.optionsContainer}>
        {recipeDescriptionOptions.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionButton,
              recipeDescriptions.includes(option) && styles.optionButtonSelected,
            ]}
            onPress={() => toggleRecipeDescription(option)}
          >
            <Text
              style={
                recipeDescriptions.includes(option)
                  ? styles.optionButtonTextSelected
                  : styles.optionButtonText
              }
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Submit Button */}
      <View style={styles.buttonContainer}>
        <Button title="Submit Recipe" onPress={handleAddRecipe} disabled={isSubmitting} />
      </View>
    </ScrollView>
  );

  /**
   * Function to render the recipe details modal
   */
  const renderRecipeDetailsModal = () => {
    if (!currentRecipe) return null;

    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={viewModalVisible}
        onRequestClose={() => {
          setViewModalVisible(false);
          resetForm();
        }}
      >
        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => {
              setViewModalVisible(false);
              resetForm();
            }}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.recipeTitle}>{currentRecipe.title || 'No Title'}</Text>
          <Image
            source={{ uri: currentRecipe.imageUrl || 'https://placehold.co/300x200' }}
            style={styles.recipeImage}
          />
          <Text style={styles.recipeText}>
            {currentRecipe.description || 'No Description Available'}
          </Text>

          {/* Display Serving Size */}
          <Text style={styles.sectionTitle}>Serving Size</Text>
          <Text style={styles.sectionText}>
            {currentRecipe.servingSize || 'Not Specified'}
          </Text>

          {/* Display Cooking Time */}
          <Text style={styles.sectionTitle}>Cooking Time</Text>
          <Text style={styles.sectionText}>
            {currentRecipe.cookingTime || 'Not Specified'}
          </Text>

          {/* Display Recipe Difficulty */}
          <Text style={styles.sectionTitle}>Recipe Difficulty</Text>
          <Text style={styles.sectionText}>
            {currentRecipe.recipeDifficulty || 'Not Specified'}
          </Text>

          {/* Display Ingredients */}
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {currentRecipe.ingredients && currentRecipe.ingredients.length > 0 ? (
            currentRecipe.ingredients.map((ingredient, index) => (
              <Text key={index} style={styles.sectionText}>
                - {ingredient.quantity} {ingredient.unit} {ingredient.description}
              </Text>
            ))
          ) : (
            <Text style={styles.sectionText}>No Ingredients Available</Text>
          )}

          {/* Display Instructions */}
          <Text style={styles.sectionTitle}>Instructions</Text>
          {currentRecipe.instructions && currentRecipe.instructions.length > 0 ? (
            currentRecipe.instructions.map((instruction, index) => (
              <Text key={index} style={styles.sectionText}>
                Step {index + 1}: {instruction}
              </Text>
            ))
          ) : (
            <Text style={styles.sectionText}>No Instructions Available</Text>
          )}

          {/* Display Total Nutrition */}
          <Text style={styles.sectionTitle}>Total Nutrition</Text>
          {currentRecipe.totalNutrition ? (
            <View style={styles.nutritionContainer}>
              <Text>Calories: {currentRecipe.totalNutrition.calories.toFixed(2)}</Text>
              <Text>Protein: {currentRecipe.totalNutrition.protein.toFixed(2)}g</Text>
              <Text>Fat: {currentRecipe.totalNutrition.fat.toFixed(2)}g</Text>
              <Text>Carbohydrates: {currentRecipe.totalNutrition.carbohydrates.toFixed(2)}g</Text>
            </View>
          ) : (
            <Text style={styles.sectionText}>No Nutrition Data Available</Text>
          )}
        </ScrollView>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BackArrow onPress={() => router.back()} />
        <Text style={styles.title}>My Recipes</Text>
      </View>

      {/* Floating Tabs */}
      <View style={styles.floatingTabs}>
        <TouchableOpacity
          style={[styles.segmentButton, activeTab === 'under_review' && styles.activeSegment]}
          onPress={() => setActiveTab('under_review')}
        >
          <Text
            style={activeTab === 'under_review' ? styles.activeSegmentText : styles.segmentText}
          >
            Under Review
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, activeTab === 'uploaded' && styles.activeSegment]}
          onPress={() => setActiveTab('uploaded')}
        >
          <Text style={activeTab === 'uploaded' ? styles.activeSegmentText : styles.segmentText}>
            Uploaded
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recipe List */}
      <FlatList
        data={activeTab === 'uploaded' ? uploadedRecipes : pendingRecipes}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.recipeCard}
            onPress={() => {
              setCurrentRecipe(item);
              setViewModalVisible(true);
            }}
          >
            <Image
              source={{ uri: item.imageUrl || 'https://placehold.co/300x200' }}
              style={styles.recipeImage}
            />
            <Text style={styles.recipeTitle}>{item.title}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={[styles.scrollContainer, { paddingTop: 100 }]}
      />

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.floatingButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.floatingButtonText}>+</Text>
      </TouchableOpacity>

      {/* Recipe Modal - Viewing Recipe Details */}
      <RecipeModal
        visible={viewModalVisible}
        onClose={() => {
          setViewModalVisible(false);
          setCurrentRecipe(null);
        }}
        recipe={currentRecipe}
      />

      {/* Add Recipe Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        {renderModalContent()}
      </Modal>
    </View>
  );
}

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    padding: 10,
    borderColor: '#ccc',
    borderRadius: 5,
    color: '#000',
    marginBottom: 10,
  },
  inputAndroid: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    padding: 8,
    borderColor: '#ccc',
    borderRadius: 5,
    color: '#000',
    marginBottom: 10,
  },
  placeholder: {
    color: '#888',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  formContainer: {
    padding: 20,
    backgroundColor: '#fff',
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  closeButtonText: {
    color: '#007bff',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  input: {
    height: 40,
    borderWidth: 1,
    padding: 10,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 10,
  },
  textArea: {
    minHeight: 60,
    borderWidth: 1,
    padding: 10,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 5,
    textAlignVertical: 'top',
  },
  charCount: {
    alignSelf: 'flex-end',
    color: '#888',
    marginBottom: 10,
  },
  uploadBox: {
    height: 200,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusSign: {
    fontSize: 50,
    color: '#ccc',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
  },
  progressContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  cookingTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cookingTimeInputContainer: {
    flex: 1,
    alignItems: 'center',
  },
  cookingTimeInput: {
    height: 40,
    width: '80%',
    borderWidth: 1,
    padding: 10,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 5,
    textAlign: 'center',
  },
  cookingTimeLabel: {
    fontSize: 14,
  },
  ingredientRow: {
    flexDirection: 'row',
    marginBottom: 10,
    position: 'relative',
    zIndex: 1,
  },
  ingredientInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    marginRight: 5,
    padding: 10,
    borderRadius: 5,
    borderColor: '#ccc',
    zIndex: 2,
  },
  quantityInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    marginRight: 5,
    padding: 10,
    borderRadius: 5,
    borderColor: '#ccc',
    textAlign: 'center',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 50 : 45,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    maxHeight: 150,
    zIndex: 3,
    elevation: 3,
  },
  suggestionItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mealTimeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mealTimeButton: {
    padding: 10,
    backgroundColor: '#eee',
    margin: 5,
    borderRadius: 5,
  },
  mealTimeButtonSelected: {
    backgroundColor: '#007bff',
  },
  mealTimeButtonText: {
    color: '#333',
  },
  mealTimeButtonTextSelected: {
    color: '#fff',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionButton: {
    padding: 10,
    backgroundColor: '#eee',
    margin: 5,
    borderRadius: 5,
  },
  optionButtonSelected: {
    backgroundColor: '#007bff',
  },
  optionButtonText: {
    color: '#333',
  },
  optionButtonTextSelected: {
    color: '#fff',
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: 40,
    backgroundColor: '#fff',
    elevation: 2,
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginLeft: 10,
  },
  floatingTabs: {
    flexDirection: 'row',
    position: 'absolute',
    top: 90,
    left: 0,
    right: 0,
    justifyContent: 'center',
    zIndex: 10,
  },
  segmentButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#eee',
    marginHorizontal: 5,
    borderRadius: 20,
  },
  activeSegment: {
    backgroundColor: '#007bff',
  },
  segmentText: {
    color: '#333',
  },
  activeSegmentText: {
    color: '#fff',
  },
  scrollContainer: {
    paddingHorizontal: 15,
  },
  recipeCard: {
    marginBottom: 20,
  },
  recipeImage: {
    width: '100%',
    height: 200,
    borderRadius: 5,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
  },
  recipeText: {
    fontSize: 16,
    marginVertical: 10,
  },
  sectionText: {
    fontSize: 16,
    marginBottom: 5,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#28a745', // Green color
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
  },
  floatingButtonText: {
    fontSize: 28,
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  apiLimitBanner: {
    backgroundColor: '#ffdddd',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  apiLimitBannerText: {
    color: '#d8000c',
    textAlign: 'center',
  },
  nutritionContainer: {
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
    marginBottom: 20,
  },
});

export default MyRecipes;
