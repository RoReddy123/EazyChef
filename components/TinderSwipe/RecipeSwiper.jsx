// components/TinderSwipe/RecipeSwiper.jsx
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Animated,
  PanResponder,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Modal,
  Easing,
  Image,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State, Swipeable } from 'react-native-gesture-handler';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { db, auth } from './../../configs/FirebaseConfig'; // Adjust path as needed
import { AntDesign } from '@expo/vector-icons';
import RecipeModal from '../../app/RecipeModal'; // Ensure correct path and export
import { EvilIcons } from '@expo/vector-icons';
import { Video, Audio } from 'expo-av'; // Import Audio from expo-av
import Slider from '@react-native-community/slider';
import withNavigation from './withNavigation'; // Adjust the path based on your project structure

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

class RecipeSwiper extends React.Component {
  constructor(props) {
    super(props);
    this.position = new Animated.ValueXY();
    this.audio = new Audio.Sound();
    this.isPlaying = false;
    this.activeVideo = React.createRef(); // Initialize ref for Video

    this.state = {
      recipes: [],
      currentIndex: 0,
      modalVisible: false, // Controls Modal visibility
      currentView: 'none', // 'none', 'liked', or 'recipe'
      selectedRecipe: null, // Holds the selected recipe data
      transitionAnim: new Animated.Value(0), // For animated transitions
      loading: true,
      favorites: [], // User's favorites
      likedRecipes: [], // User's liked recipes
      wordScores: {},
      swipedRecipes: [],
      modalOrigin: 'none', // 'liked' or 'direct'
      currentAudioUri: null, // Tracks the currently playing audio
      isAudioPlaying: false, // Boolean indicating if audio is playing
      isVideoPlaying: false, // Boolean indicating if video is playing
      audioPosition: 0, // Current position in audio
      audioDuration: 1, // Duration of audio
      videoPosition: 0, // Current position in video
      videoDuration: 1, // Duration of video
      tapTimeout: null, // Timer for tap detection
      longPressTriggered: false, // Flag for long press
    };

    this.rotate = this.position.x.interpolate({
      inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      outputRange: ['-10deg', '0deg', '10deg'],
      extrapolate: 'clamp',
    });

    this.rotateAndTranslate = {
      transform: [
        { rotate: this.rotate },
        ...this.position.getTranslateTransform(),
      ],
    };

    // Bind methods
    this.handleTap = this.handleTap.bind(this);
    this.handleLongPress = this.handleLongPress.bind(this);

    this.PanResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Start long press timer
        this.setState({ longPressTriggered: false });
        this.state.tapTimeout = setTimeout(() => {
          this.handleLongPress();
          this.setState({ longPressTriggered: true });
        }, 500); // 500ms for long press
      },
      onPanResponderMove: (evt, gestureState) => {
        this.position.setValue({ x: gestureState.dx, y: gestureState.dy });
        // If user is swiping, cancel the tap/long press
        if (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10) {
          if (this.state.tapTimeout) {
            clearTimeout(this.state.tapTimeout);
            this.setState({ tapTimeout: null });
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (this.state.tapTimeout) {
          clearTimeout(this.state.tapTimeout);
          this.setState({ tapTimeout: null });
          if (!this.state.longPressTriggered) {
            this.handleTap();
          }
        }

        if (gestureState.dx > 120) {
          // Swiped Right - Like the recipe
          this.handleSwipe('like', gestureState.dy);
        } else if (gestureState.dx < -120) {
          // Swiped Left - Dislike the recipe
          this.handleSwipe('dislike', gestureState.dy);
        } else {
          // Not enough swipe - Reset position
          Animated.spring(this.position, {
            toValue: { x: 0, y: 0 },
            friction: 4,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminationRequest: () => true,
      onShouldBlockNativeResponder: () => false,
    });
  }

  componentDidMount() {
    this.setupAudio();
    this.fetchRecipes();
    this.listenForFavorites();
    this.listenForLikedRecipes();

    // Add navigation listeners
    if (this.props.navigation) {
      this.focusListener = this.props.navigation.addListener('focus', () => {
        // Component has gained focus
        // Optionally, perform actions when the screen is focused
        console.log('RecipeSwiper focused');
      });

      this.blurListener = this.props.navigation.addListener('blur', () => {
        // Component has lost focus, pause video and audio
        this.pauseVideoIfNeeded();
        this.pauseAudio();
        console.log('RecipeSwiper blurred');
      });
    }
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.selectedMealTimes !== this.props.selectedMealTimes ||
      prevProps.selectedDietaryPreferences !== this.props.selectedDietaryPreferences
    ) {
      this.fetchRecipes();
    }
  }

  componentWillUnmount() {
    // Unsubscribe from Firestore listeners
    if (this.unsubscribeLikedRecipes) {
      this.unsubscribeLikedRecipes();
    }
    if (this.unsubscribeFavorites) {
      this.unsubscribeFavorites();
    }

    // Stop and unload audio when the component unmounts
    this.stopAudio();
    this.pauseVideoIfNeeded();

    // Clear any pending tap timeout
    if (this.state.tapTimeout) {
      clearTimeout(this.state.tapTimeout);
    }

    // Unload video if necessary
    if (this.activeVideo.current) {
      this.activeVideo.current.unloadAsync();
    }

    // Remove navigation listeners
    if (this.focusListener && this.focusListener.remove) {
      this.focusListener.remove();
    }
    if (this.blurListener && this.blurListener.remove) {
      this.blurListener.remove();
    }
  }

  // Configure Audio Mode
  setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        interruptionModeIOS: 1,
        playsInSilentModeIOS: true, // Allows audio to play even in silent mode
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1,
        playThroughEarpieceAndroid: false,
      });
      console.log('Audio mode set successfully');
    } catch (error) {
      console.error('Error setting audio mode:', error);
      Alert.alert('Audio Error', 'Failed to configure audio settings.');
    }
  };

  // Listen for LikedRecipes in Firestore
  listenForLikedRecipes = () => {
    const user = auth.currentUser;

    if (!user) {
      console.log('User is not authenticated. Cannot listen for liked recipes.');
      return;
    }

    const likedRecipesCollection = collection(db, 'LikedRecipes', user.uid, 'UserLikedRecipes');

    this.unsubscribeLikedRecipes = onSnapshot(
      likedRecipesCollection,
      (snapshot) => {
        const likedRecipes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        this.setState({ likedRecipes });
      },
      (error) => {
        console.error('Error listening to liked recipes: ', error);
        Alert.alert('Error', 'Failed to listen for liked recipes.');
      }
    );
  };

  // Listen for Favorites
  listenForFavorites = () => {
    const user = auth.currentUser;

    if (!user) {
      console.log('User is not authenticated. Cannot listen for favorites.');
      return;
    }

    const favoritesCollection = collection(db, 'Favorites', user.uid, 'UserFavorites');

    this.unsubscribeFavorites = onSnapshot(
      favoritesCollection,
      snapshot => {
        const favorites = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        this.setState({ favorites });
      },
      error => {
        console.error('Error listening to favorites: ', error);
        Alert.alert('Error', 'Failed to listen for favorites.');
      }
    );
  };

  // Fetch recipes from Firestore excluding liked recipes
  fetchRecipes = async () => {
    const { selectedMealTimes, selectedDietaryPreferences } = this.props;
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Error', 'User not authenticated.');
      this.setState({ loading: false });
      return;
    }

    try {
      // Fetch liked recipes IDs
      const likedRecipesCollection = collection(db, 'LikedRecipes', user.uid, 'UserLikedRecipes');
      const likedRecipesSnapshot = await getDocs(likedRecipesCollection);
      const likedRecipeIds = likedRecipesSnapshot.docs.map(doc => doc.id);

      let recipesQuery = collection(db, 'AllRecipes');

      if (selectedMealTimes && selectedMealTimes.length > 0) {
        recipesQuery = query(
          recipesQuery,
          where('mealTimes', 'array-contains-any', selectedMealTimes)
        );
      }

      // Fetch recipes from Firestore
      const querySnapshot = await getDocs(recipesQuery);
      let recipes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Client-side filtering for dietaryPreferences
      if (selectedDietaryPreferences && selectedDietaryPreferences.length > 0) {
        recipes = recipes.filter(recipe => {
          const recipeDietaryPreferences = recipe.dietaryPreferences || [];
          return selectedDietaryPreferences.every(pref =>
            recipeDietaryPreferences.includes(pref)
          );
        });
      }

      // Exclude already liked recipes
      recipes = recipes.filter(recipe => !likedRecipeIds.includes(recipe.id));

      this.setState({ recipes, loading: false }, () => {
        this.reorderRecipes();
      });
    } catch (error) {
      console.error('Error fetching recipes: ', error);
      Alert.alert('Error', 'Failed to fetch recipes.');
      this.setState({ loading: false });
    }
  };

  // Handle Tap Gesture
  handleTap = () => {
    this.toggleVideoPlayback();
  };

  // Handle Long Press Gesture
  handleLongPress = () => {
    this.pauseVideoIfNeeded();
  };

  // Toggle video playback
  toggleVideoPlayback = async () => {
    if (this.activeVideo.current) {
      const status = await this.activeVideo.current.getStatusAsync();
      if (status.isPlaying) {
        await this.activeVideo.current.pauseAsync();
        this.setState({ isVideoPlaying: false });
      } else {
        await this.activeVideo.current.playAsync();
        this.setState({ isVideoPlaying: true });
      }
    }
  };

  // Play Audio Method
  playAudio = async (audioUri) => {
    try {
      console.log('Attempting to play audio:', audioUri);

      // If already playing a different audio, unload it first
      if (this.isPlaying && this.state.currentAudioUri !== audioUri) {
        await this.audio.unloadAsync();
        this.isPlaying = false;
        this.setState({ isAudioPlaying: false, currentAudioUri: null });
        console.log('Unloaded previous audio');
      }

      // If the same audio is paused, resume it
      if (this.state.currentAudioUri === audioUri && !this.state.isAudioPlaying) {
        await this.audio.playAsync();
        this.isPlaying = true;
        this.setState({ isAudioPlaying: true });
        console.log('Resumed audio playback');
        return;
      }

      // Load and play new audio
      await this.audio.loadAsync({ uri: audioUri }, { shouldPlay: true });
      this.isPlaying = true;
      this.setState({ isAudioPlaying: true, currentAudioUri: audioUri });
      console.log('Audio loaded and playing');

      // Handle playback status updates
      this.audio.setOnPlaybackStatusUpdate(this.onAudioPlaybackStatusUpdate);
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Audio Error', 'Failed to play the audio.');
    }
  };

  // Pause Audio Method
  pauseAudio = async () => {
    try {
      const status = await this.audio.getStatusAsync();
      console.log('Attempting to pause audio:', status);

      if (status.isLoaded && status.isPlaying) {
        await this.audio.pauseAsync();
        this.isPlaying = false;
        this.setState({ isAudioPlaying: false });
        console.log('Audio paused');
      }
    } catch (error) {
      console.error('Error pausing audio:', error);
      Alert.alert('Audio Error', 'Failed to pause the audio.');
    }
  };

  // Stop Audio Method
  stopAudio = async () => {
    try {
      const status = await this.audio.getStatusAsync();
      console.log('Attempting to stop audio:', status);

      if (status.isLoaded) {
        await this.audio.stopAsync();
        await this.audio.unloadAsync();
        this.isPlaying = false;
        this.setState({ isAudioPlaying: false, currentAudioUri: null });
        console.log('Audio stopped and unloaded');
      }
    } catch (error) {
      console.error('Error stopping audio:', error);
      Alert.alert('Audio Error', 'Failed to stop the audio.');
    }
  };

  // Handler for Audio Playback Status Updates
  onAudioPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      if (status.isPlaying) {
        this.setState({
          audioPosition: status.positionMillis,
          audioDuration: status.durationMillis,
        });
      }
      if (status.didJustFinish && !status.isLooping) {
        console.log('Audio playback finished');
        this.isPlaying = false;
        this.setState({ isAudioPlaying: false, currentAudioUri: null, audioPosition: 0 });
        // Optionally, update UI or perform actions after audio finishes
      }
    }
  };

  // Handler for Video Playback Status Updates
  onVideoPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      if (status.isPlaying) {
        this.setState({
          videoPosition: status.positionMillis,
          videoDuration: status.durationMillis,
        });
      }
      if (status.didJustFinish && !status.isLooping) {
        console.log('Video playback finished');
        this.setState({ isVideoPlaying: false, videoPosition: 0 });
        // Optionally, perform actions when video finishes
      }
    } else if (status.error) {
      console.error('Video Error:', status.error);
      Alert.alert('Video Error', 'Failed to load the video.');
    }
  };

  // Pause any active video when swiping to a new card
  pauseVideoIfNeeded = async () => {
    if (this.activeVideo.current) {
      const status = await this.activeVideo.current.getStatusAsync();
      if (status.isPlaying) {
        await this.activeVideo.current.pauseAsync();
        this.setState({ isVideoPlaying: false });
        console.log('Video paused due to navigation or modal open');
      }
    }
  };

  // Handle swipe actions
  handleSwipe = (action, dy) => {
    const { recipes, currentIndex, wordScores, swipedRecipes } = this.state;
    const currentRecipe = recipes[currentIndex];

    // Extract words from the recipe
    const words = [];

    // Ensure ingredients exist and are valid before processing
    if (currentRecipe.ingredients && Array.isArray(currentRecipe.ingredients)) {
      currentRecipe.ingredients.forEach(ingredient => {
        if (ingredient && ingredient.name) {
          words.push(ingredient.name.toLowerCase());
        }
      });
    }

    // Ensure recipeDescriptions exist and are valid before processing
    if (currentRecipe.recipeDescriptions && Array.isArray(currentRecipe.recipeDescriptions)) {
      currentRecipe.recipeDescriptions.forEach(desc => {
        if (desc) {
          words.push(desc.toLowerCase());
        }
      });
    }

    // Ensure dietaryPreferences exist and are valid before processing
    if (currentRecipe.dietaryPreferences && Array.isArray(currentRecipe.dietaryPreferences)) {
      currentRecipe.dietaryPreferences.forEach(pref => {
        if (pref) {
          words.push(pref.toLowerCase());
        }
      });
    }

    // Adjust word scores
    const newWordScores = { ...wordScores };
    words.forEach(word => {
      if (action === 'like') {
        newWordScores[word] = (newWordScores[word] || 0) + 1;
      } else {
        newWordScores[word] = (newWordScores[word] || 0) - 1;
        // Optionally, remove the word if score drops below a threshold
        if (newWordScores[word] <= 0) {
          delete newWordScores[word];
        }
      }
    });

    // Log the updated word scores
    console.log('Updated wordScores:', newWordScores);

    // Add the recipe to swipedRecipes to prevent re-showing
    const newSwipedRecipes = [...swipedRecipes, currentRecipe.id];

    // Update state and reorder recipes
    this.setState(
      {
        wordScores: newWordScores,
        swipedRecipes: newSwipedRecipes,
        currentIndex: currentIndex + 1,
      },
      () => {
        this.reorderRecipes();
        this.pauseVideoIfNeeded(); // Pause video when swiping
      }
    );

    // Animate the swipe off-screen
    Animated.spring(this.position, {
      toValue: { x: action === 'like' ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100, y: dy },
      useNativeDriver: true,
    }).start(() => {
      this.position.setValue({ x: 0, y: 0 });
    });

    // If liked, save to Firestore
    if (action === 'like') {
      this.saveLikedRecipe(currentRecipe);
    }
  };

  // Reorder recipes based on wordScores
  reorderRecipes = () => {
    const { recipes, wordScores, swipedRecipes } = this.state;

    // Filter out swiped recipes
    const remainingRecipes = recipes.filter(recipe => !swipedRecipes.includes(recipe.id));

    // Compute score for each recipe
    const scoredRecipes = remainingRecipes.map(recipe => {
      let score = 0;
      const words = [];

      if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
        recipe.ingredients.forEach(ingredient => {
          if (ingredient && ingredient.name) {
            words.push(ingredient.name.toLowerCase());
          }
        });
      }

      if (recipe.recipeDescriptions && Array.isArray(recipe.recipeDescriptions)) {
        recipe.recipeDescriptions.forEach(desc => {
          if (desc) {
            words.push(desc.toLowerCase());
          }
        });
      }

      if (recipe.dietaryPreferences && Array.isArray(recipe.dietaryPreferences)) {
        recipe.dietaryPreferences.forEach(pref => {
          if (pref) {
            words.push(pref.toLowerCase());
          }
        });
      }

      words.forEach(word => {
        if (wordScores[word]) {
          score += wordScores[word];
        }
      });

      // Attach the score to the recipe
      return { ...recipe, score };
    });

    // Log the scores of recipes before sorting
    console.log('Recipes with scores before sorting:', scoredRecipes);

    // Sort recipes by score in descending order
    scoredRecipes.sort((a, b) => b.score - a.score);

    // Log the reordered recipes
    console.log(
      'Reordered recipes:',
      scoredRecipes.map(r => ({ title: r.title, score: r.score }))
    );

    // Update the recipes and reset currentIndex
    this.setState({
      recipes: scoredRecipes,
      currentIndex: 0,
    });
  };

  // Define the right actions for Swipeable (Delete Button)
  renderRightActions = (progress, dragX, recipeId) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity
        style={styles.deleteButtonContainer}
        onPress={() => this.removeLikedRecipe(recipeId)}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <AntDesign name="delete" size={24} color="white" />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Render the recipe cards with Video and Audio
  renderUsers = () => {
    const { recipes, currentIndex, audioPosition, audioDuration, videoPosition, videoDuration } = this.state;

    if (recipes.length === 0) {
      return (
        <View style={styles.noRecipesContainer}>
          <Text style={styles.noRecipesText}>No more recipes to show!</Text>
        </View>
      );
    }

    return recipes
      .map((item, i) => {
        if (i < currentIndex) {
          return null;
        } else if (i === currentIndex) {
          return (
            <Animated.View
              {...this.PanResponder.panHandlers}
              key={item.id}
              style={[
                this.rotateAndTranslate,
                {
                  height: SCREEN_HEIGHT - 300,
                  width: SCREEN_WIDTH,
                  padding: 10,
                  position: 'absolute',
                  zIndex: 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                {item.videoUrl ? (
                  <View style={styles.videoContainer}>
                    <Video
                      ref={this.activeVideo} // Assign the ref here
                      source={{ uri: item.videoUrl }}
                      style={styles.video}
                      resizeMode="cover"
                      shouldPlay
                      isLooping
                      isMuted={false}
                      onError={(error) => {
                        console.error('Video Error:', error);
                        Alert.alert('Video Error', 'Failed to load the video.');
                      }}
                      onPlaybackStatusUpdate={this.onVideoPlaybackStatusUpdate}
                    />

                    {/* Video Playback Slider */}
                    <View style={styles.videoSliderContainer}>
                      <Slider
                        style={styles.videoSlider}
                        minimumValue={0}
                        maximumValue={videoDuration}
                        value={videoPosition}
                        minimumTrackTintColor="#1FB28A"
                        maximumTrackTintColor="#d3d3d3"
                        // Match with maximumTrackTintColor to minimize visibility
                        onSlidingStart={() => {
                          // Pause the video while seeking
                          if (this.state.isVideoPlaying && this.activeVideo.current) {
                            this.activeVideo.current.pauseAsync();
                          }
                        }}
                        onSlidingComplete={async (value) => {
                          try {
                            if (this.activeVideo.current) {
                              await this.activeVideo.current.setPositionAsync(value);
                              this.setState({ videoPosition: value });
                              // Resume playing if it was playing before
                              if (this.state.isVideoPlaying && this.activeVideo.current) {
                                this.activeVideo.current.playAsync();
                              }
                            }
                          } catch (error) {
                            console.error('Error seeking video:', error);
                            Alert.alert('Seek Error', 'Failed to seek the video.');
                          }
                        }}
                      />
                      <View style={styles.timeContainer}>
                        <Text style={styles.timeText}>{this.formatTime(videoPosition)}</Text>
                        <Text style={styles.timeText}>{this.formatTime(videoDuration)}</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Image
                    style={styles.image}
                    source={{ uri: item.imageUrl }}
                  />
                )}

                {/* Audio Controls */}
                {item.audioUrl && (
                  <View style={styles.audioControlsContainer}>
                    <View style={styles.audioControls}>
                      <TouchableOpacity
                        onPress={() =>
                          this.state.isAudioPlaying && this.state.currentAudioUri === item.audioUrl
                            ? this.pauseAudio()
                            : this.playAudio(item.audioUrl)
                        }
                        style={styles.audioButton}
                        accessibilityLabel={
                          this.state.isAudioPlaying && this.state.currentAudioUri === item.audioUrl
                            ? 'Pause Audio'
                            : 'Play Audio'
                        }
                        accessibilityHint="Toggles audio playback"
                      >
                        <AntDesign
                          name={
                            this.state.isAudioPlaying && this.state.currentAudioUri === item.audioUrl
                              ? 'pausecircleo'
                              : 'playcircleo'
                          }
                          size={32}
                          color="#fff"
                        />
                      </TouchableOpacity>

                      {/* Playback Slider */}
                      <Slider
                        style={styles.playbackSlider}
                        minimumValue={0}
                        maximumValue={audioDuration}
                        value={audioPosition}
                        minimumTrackTintColor="#1FB28A"
                        maximumTrackTintColor="#d3d3d3"
                        thumbTintColor="#1FB28A"
                        onSlidingStart={() => {
                          // Pause the audio while seeking
                          if (this.state.isAudioPlaying) {
                            this.pauseAudio();
                          }
                        }}
                        onSlidingComplete={async (value) => {
                          try {
                            await this.audio.setPositionAsync(value);
                            this.setState({ audioPosition: value });
                            // Resume playing if it was playing before
                            if (this.state.isAudioPlaying) {
                              this.playAudio(this.state.currentAudioUri);
                            }
                          } catch (error) {
                            console.error('Error seeking audio:', error);
                            Alert.alert('Seek Error', 'Failed to seek the audio.');
                          }
                        }}
                      />

                      {/* Optional: Display Current Time and Duration */}
                      <View style={styles.timeContainer}>
                        <Text style={styles.timeText}>{this.formatTime(audioPosition)}</Text>
                        <Text style={styles.timeText}>{this.formatTime(audioDuration)}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </Animated.View>
          );
        } else {
          return (
            <Animated.View
              key={item.id}
              style={{
                opacity: 0.5,
                height: SCREEN_HEIGHT - 300,
                width: SCREEN_WIDTH,
                padding: 10,
                position: 'absolute',
                zIndex: 0,
              }}
            >
              <View style={{ flex: 1 }}>
                {item.videoUrl ? (
                  <Video
                    source={{ uri: item.videoUrl }}
                    style={styles.video}
                    resizeMode="cover"
                    shouldPlay={false} // Pause videos that are not the current index
                    isLooping
                    isMuted={false}
                    onError={(error) => {
                      console.error('Video Error:', error);
                      // Optionally, handle the error (e.g., show a placeholder)
                    }}
                    onPlaybackStatusUpdate={this.onVideoPlaybackStatusUpdate}
                  />
                ) : (
                  <Image
                    style={styles.image}
                    source={{ uri: item.imageUrl }}
                  />
                )}

                {/* Audio Controls */}
                {item.audioUrl && (
                  <View style={styles.audioControlsContainer}>
                    <View style={styles.audioControls}>
                      <TouchableOpacity
                        onPress={() =>
                          this.state.isAudioPlaying && this.state.currentAudioUri === item.audioUrl
                            ? this.pauseAudio()
                            : this.playAudio(item.audioUrl)
                        }
                        style={styles.audioButton}
                        accessibilityLabel={
                          this.state.isAudioPlaying && this.state.currentAudioUri === item.audioUrl
                            ? 'Pause Audio'
                            : 'Play Audio'
                        }
                        accessibilityHint="Toggles audio playback"
                      >
                        <AntDesign
                          name={
                            this.state.isAudioPlaying && this.state.currentAudioUri === item.audioUrl
                              ? 'pausecircleo'
                              : 'playcircleo'
                          }
                          size={24}
                          color="#fff"
                        />
                      </TouchableOpacity>

                      {/* Playback Slider */}
                      <Slider
                        style={styles.playbackSlider}
                        minimumValue={0}
                        maximumValue={audioDuration}
                        value={audioPosition}
                        minimumTrackTintColor="#1FB28A"
                        maximumTrackTintColor="#d3d3d3"
                        thumbTintColor="#1FB28A"
                        onSlidingStart={() => {
                          // Pause the audio while seeking
                          if (this.state.isAudioPlaying) {
                            this.pauseAudio();
                          }
                        }}
                        onSlidingComplete={async (value) => {
                          try {
                            await this.audio.setPositionAsync(value);
                            this.setState({ audioPosition: value });
                            // Resume playing if it was playing before
                            if (this.state.isAudioPlaying) {
                              this.playAudio(this.state.currentAudioUri);
                            }
                          } catch (error) {
                            console.error('Error seeking audio:', error);
                            Alert.alert('Seek Error', 'Failed to seek the audio.');
                          }
                        }}
                      />

                      {/* Optional: Display Current Time and Duration */}
                      <View style={styles.timeContainer}>
                        <Text style={styles.timeText}>{this.formatTime(audioPosition)}</Text>
                        <Text style={styles.timeText}>{this.formatTime(audioDuration)}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </Animated.View>
          );
        }
      })
      .reverse();
  };

  // Render Liked Recipes in the Modal
  renderLikedRecipes = () => {
    const { likedRecipes } = this.state;

    if (likedRecipes.length === 0) {
      return (
        <View style={styles.noFavoritesContainer}>
          <Text style={styles.noFavoritesText}>No liked recipes yet!</Text>
        </View>
      );
    }

    return likedRecipes.map(item => (
      <Swipeable
        key={item.id}
        renderRightActions={(progress, dragX) => this.renderRightActions(progress, dragX, item.id)}
        overshootRight={false} // Prevents the Swipeable from overshooting
      >
        <TouchableOpacity
          onPress={() => this.selectLikedRecipe(item)}
          activeOpacity={0.7}
        >
          <View style={styles.likedRecipeRow}>
            <Image source={{ uri: item.imageUrl }} style={styles.likedRecipeImage} />
            <Text style={styles.likedRecipeTitle}>{item.title}</Text>
            <EvilIcons name="chevron-right" size={24} color="black" style={styles.chevronIcon} />
            {/* Removed the static delete button */}
          </View>
        </TouchableOpacity>
      </Swipeable>
    ));
  };

  // Open Modal with specified view ('liked' or 'recipe')
  openModal = (view, origin, recipe = null) => {
    // Pause video and audio before opening the modal
    this.pauseVideoIfNeeded();
    this.pauseAudio();

    this.setState({ modalVisible: true, currentView: view, selectedRecipe: recipe, modalOrigin: origin }, () => {
      // Start the entrance animation
      Animated.timing(this.state.transitionAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();
    });
  };

  // Close Modal with reverse animation
  closeModal = () => {
    // Start the exit animation
    Animated.timing(this.state.transitionAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.in(Easing.ease),
    }).start(() => {
      const { modalOrigin, currentView } = this.state;
      if (modalOrigin === 'liked' && currentView === 'recipe') {
        // If the RecipeModal was opened from Liked Recipes, return to Liked Recipes
        this.setState({ currentView: 'liked', selectedRecipe: null }, () => {
          // Start the entrance animation for Liked Recipes
          Animated.timing(this.state.transitionAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }).start();
        });
      } else {
        // Otherwise, hide the Modal entirely
        this.setState({ modalVisible: false, currentView: 'none', selectedRecipe: null, modalOrigin: 'none' });
      }
    });
  };

  // Switch view within the Modal (from Liked Recipes to RecipeModal)
  switchView = (newView, recipe = null) => {
    // Animate out the current view
    Animated.timing(this.state.transitionAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.in(Easing.ease),
    }).start(() => {
      // Update the view and selected recipe
      this.setState({ currentView: newView, selectedRecipe: recipe, modalOrigin: 'liked' }, () => {
        // Animate in the new view
        Animated.timing(this.state.transitionAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }).start();
      });
    });
  };

  // Opens the Liked Recipes Modal
  showLikedRecipes = () => {
    this.openModal('liked', 'liked');
  };

  // Opens the Recipe Modal directly via swipe-up or utensils button
  openRecipeModalDirectly = () => {
    const { recipes, currentIndex } = this.state;
    if (recipes.length > 0) {
      const recipeToOpen = recipes[currentIndex];
      this.openModal('recipe', 'direct', recipeToOpen);
    } else {
      Alert.alert('No Recipes', 'There are no recipes available to display.');
    }
  };

  // Opens the Recipe Modal from the Liked Recipes Modal
  selectLikedRecipe = (recipe) => {
    this.switchView('recipe', recipe);
  };

  // Swipe-Up Gesture: Directly opens the RecipeModal
  onSwipeUpGesture = ({ nativeEvent }) => {
    if (nativeEvent.state === State.END) {
      if (nativeEvent.velocityY < -0.5) {
        this.openRecipeModalDirectly(); // Open RecipeModal directly
      }
    }
  };

  // Save a recipe to Favorites
  saveRecipe = async () => {
    const { selectedRecipe } = this.state;
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Error', 'You must be signed in to save favorites.');
      return;
    }

    try {
      const favoritesCollection = collection(db, 'Favorites', user.uid, 'UserFavorites');
      const recipeDocRef = doc(favoritesCollection, selectedRecipe.id);

      // Check if the recipe is already in favorites to prevent duplicates
      const recipeDoc = await getDoc(recipeDocRef);

      if (!recipeDoc.exists()) {
        // Add the recipe to 'Favorites' if it's not already there
        await setDoc(recipeDocRef, {
          recipeId: selectedRecipe.id,
          title: selectedRecipe.title,
          imageUrl: selectedRecipe.imageUrl,
          ingredients: selectedRecipe.ingredients || [],
          recipeDescriptions: selectedRecipe.recipeDescriptions || [],
          dietaryPreferences: selectedRecipe.dietaryPreferences || [],
          savedAt: new Date(),
        });

        console.log(`Recipe saved to favorites: ${selectedRecipe.title}`);
        Alert.alert('Success', 'Recipe saved to favorites!');
      } else {
        Alert.alert('Info', 'Recipe is already in your favorites.');
      }
    } catch (error) {
      console.error('Error saving recipe to favorites: ', error);
      Alert.alert('Error', 'Failed to save the recipe.');
    }
  };

  // Save a recipe to LikedRecipes in Firestore
  saveLikedRecipe = async (recipe) => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Error', 'You must be signed in to like recipes.');
      return;
    }

    try {
      const likedRecipesCollection = collection(db, 'LikedRecipes', user.uid, 'UserLikedRecipes');
      const recipeDocRef = doc(likedRecipesCollection, recipe.id);

      await setDoc(recipeDocRef, {
        recipeId: recipe.id,
        title: recipe.title,
        imageUrl: recipe.imageUrl,
        ingredients: recipe.ingredients || [],
        recipeDescriptions: recipe.recipeDescriptions || [],
        dietaryPreferences: recipe.dietaryPreferences || [],
        likedAt: new Date(),
      });

      console.log(`Recipe liked and saved: ${recipe.title}`);
    } catch (error) {
      console.error('Error saving liked recipe: ', error);
      Alert.alert('Error', 'Failed to like the recipe.');
    }
  };

  // Remove a recipe from LikedRecipes in Firestore
  removeLikedRecipe = async (recipeId) => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Error', 'You must be signed in to remove liked recipes.');
      return;
    }

    try {
      const likedRecipesCollection = collection(db, 'LikedRecipes', user.uid, 'UserLikedRecipes');
      const recipeDocRef = doc(likedRecipesCollection, recipeId);

      // Fetch the recipe data before deletion to update wordScores
      const recipeDoc = await getDoc(recipeDocRef);
      if (recipeDoc.exists()) {
        const recipeData = recipeDoc.data();
        await deleteDoc(recipeDocRef);

        console.log(`Recipe removed from liked recipes: ${recipeId}`);

        // Update wordScores based on the deleted recipe
        this.updateWordScoresOnDeletion(recipeData);
      } else {
        Alert.alert('Error', 'Recipe not found.');
      }
    } catch (error) {
      console.error('Error removing liked recipe: ', error);
      Alert.alert('Error', 'Failed to remove the recipe.');
    }
  };

  // Update wordScores when a recipe is deleted from LikedRecipes
  updateWordScoresOnDeletion = (recipe) => {
    const { wordScores } = this.state;
    const words = [];

    // Extract words from ingredients
    if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
      recipe.ingredients.forEach(ingredient => {
        if (ingredient && ingredient.name) {
          words.push(ingredient.name.toLowerCase());
        }
      });
    }

    // Extract words from descriptions
    if (recipe.recipeDescriptions && Array.isArray(recipe.recipeDescriptions)) {
      recipe.recipeDescriptions.forEach(desc => {
        if (desc) {
          words.push(desc.toLowerCase());
        }
      });
    }

    // Extract words from dietary preferences
    if (recipe.dietaryPreferences && Array.isArray(recipe.dietaryPreferences)) {
      recipe.dietaryPreferences.forEach(pref => {
        if (pref) {
          words.push(pref.toLowerCase());
        }
      });
    }

    // Decrement word scores
    const newWordScores = { ...wordScores };
    words.forEach(word => {
      if (newWordScores[word]) {
        newWordScores[word] -= 1;
        // Ensure scores don't go below a certain threshold, e.g., 0
        if (newWordScores[word] <= 0) {
          delete newWordScores[word];
        }
      }
    });

    // Update state and reorder recipes
    this.setState(
      {
        wordScores: newWordScores,
      },
      () => {
        this.reorderRecipes();
      }
    );

    // Log the updated word scores for debugging
    console.log('Updated wordScores after deletion:', newWordScores);
  };

  // Helper method to format time in MM:SS
  formatTime = (millis) => {
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  render() {
    const {
      loading,
      recipes,
      currentIndex,
      selectedRecipe,
      modalVisible,
      currentView,
      transitionAnim,
    } = this.state;

    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      );
    }

    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#F0F8FF' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            {recipes.length === 0 ? (
              <View style={styles.noRecipesContainer}>
                <Text style={styles.noRecipesText}>
                  No recipes found for selected meal times.
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>{this.renderUsers()}</View>
            )}

            {/* Swipe Up Buttons */}
            <PanGestureHandler onHandlerStateChange={this.onSwipeUpGesture}>
              <View style={styles.swipeUpButton}>
                {/* Container for multiple icons */}
                <View style={styles.iconContainer}>
                  {/* Utensils Icon */}
                  <TouchableOpacity
                    onPress={this.openRecipeModalDirectly}
                    style={styles.button}
                    accessibilityLabel="Open Recipe Details"
                    accessibilityHint="Opens detailed view of the current recipe"
                  >
                    <FontAwesome5 name="utensils" size={24} color="white" />
                  </TouchableOpacity>

                  {/* Heart Icon */}
                  <TouchableOpacity
                    onPress={this.showLikedRecipes}
                    style={styles.button}
                    accessibilityLabel="View Liked Recipes"
                    accessibilityHint="Displays your liked recipes"
                  >
                    <AntDesign name="heart" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </PanGestureHandler>
          </View>
        </View>

        {/* Single Modal with Dynamic Content */}
        <Modal
          animationType="none" // We'll handle animations manually
          transparent={true}
          visible={modalVisible}
          onRequestClose={this.closeModal}
        >
          <View style={styles.modalContainer}>
            <Animated.View
              style={[
                styles.modalContent,
                {
                  opacity: transitionAnim,
                  transform: [
                    {
                      translateY: transitionAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0], // Slide up from 50 pixels below
                      }),
                    },
                  ],
                },
              ]}
            >
              {currentView === 'liked' && (
                <View style={styles.likedModalContent}>
                  <View style={styles.header}>
                    <TouchableOpacity style={styles.closeButton} onPress={this.closeModal}>
                      <AntDesign name="closecircle" size={24} color="black" />
                    </TouchableOpacity>
                    <Text style={styles.recipeTitle}>Liked Recipes</Text>
                  </View>
                  <ScrollView
                    style={{ flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 30 }}
                  >
                    {this.renderLikedRecipes()}
                  </ScrollView>
                </View>
              )}

              {currentView === 'recipe' && selectedRecipe && (
                <View style={styles.recipeModalContent}>
                  <View style={styles.header}>
                    <TouchableOpacity style={styles.closeButton} onPress={this.closeModal}>
                      <AntDesign name="closecircle" size={24} color="black" />
                    </TouchableOpacity>
                    <Text style={styles.recipeTitle}>{selectedRecipe.title}</Text>
                  </View>
                  <RecipeModal
                    visible={true}
                    onClose={this.closeModal}
                    recipe={selectedRecipe}
                    onSave={this.saveRecipe}
                  />
                </View>
              )}
            </Animated.View>
          </View>
        </Modal>
      </GestureHandlerRootView>
    );
  }
}

const styles = StyleSheet.create({
  swipeUpButton: {
    marginTop: 20,
    width: '90%',
    height: 50,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
    marginBottom: 20,
  },
  iconContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '60%',
  },
  button: {
    backgroundColor: 'blue',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
  },
  modalContent: {
    width: '100%',
    height: '85%',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  likedModalContent: {
    flex: 1,
  },
  recipeModalContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  closeButton: {
    padding: 10,
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likedRecipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginVertical: 5,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  likedRecipeImage: {
    width: 50, // Adjust the size as needed
    height: 50,
    borderRadius: 5,
    marginRight: 10, // Space between image and text
  },
  likedRecipeTitle: {
    flex: 1, // Allow title to take up remaining space
    fontSize: 16,
    fontWeight: 'bold',
    flexWrap: 'wrap', // Ensure title wraps onto the next line if too long
  },
  chevronIcon: {
    marginLeft: 10, // Space between title and icon
  },
  deleteButtonContainer: {
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    width: 75,
    height: '100%',
    borderRadius: 10,
    marginVertical: 5,
  },
  videoContainer: {
    flex: 1,
    position: 'relative', // To position the slider absolutely
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  image: {
    flex: 1,
    height: null,
    width: null,
    resizeMode: 'cover',
    borderRadius: 20,
  },
  audioControlsContainer: {
    marginTop: 10,
    paddingHorizontal: 10,
  },
  audioControls: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  playbackSlider: {
    width: SCREEN_WIDTH - 40, // Adjust the width as needed
    height: 10, // Reduced height to make the thumb smaller
  },
  videoSliderContainer: {
    position: 'absolute',
    bottom: 10, // Position the slider 10 pixels from the bottom of the video
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  videoSlider: {
    width: SCREEN_WIDTH - 40, // Adjust the width as needed
    height: 20, // Further reduced height to minimize thumb size
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: SCREEN_WIDTH - 40,
    paddingHorizontal: 5,
  },
  timeText: {
    fontSize: 12,
    color: '#555',
  },
  audioButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 5,
    borderRadius: 25,
    marginBottom: 5,
  },
  noRecipesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noRecipesText: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  noFavoritesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noFavoritesText: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  progressBar: {
    marginTop: 10,
    height: 4,
    borderRadius: 2,
    width: '100%',
  },
});

// Export the component wrapped with the custom withNavigation HOC
export default withNavigation(RecipeSwiper);
