import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Share, // Import Share API
} from 'react-native';
import { AntDesign, Entypo, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, Audio } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation'; // Import for handling orientation

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

// Helper function to capitalize first letter
const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// Helper function to round a number to the nearest tenth
const roundToTenth = (value) => {
  const number = parseFloat(value);
  if (isNaN(number)) {
    return value; // Return the original value if it's not a number
  }
  return Math.round(number * 10) / 10;
};

const RecipeModal = ({ visible, onClose, recipe, onSave, loading }) => {
  // State to manage video modal visibility
  const [videoVisible, setVideoVisible] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const videoRef = React.useRef(null);

  // State to manage audio playback
  const [audioSound, setAudioSound] = useState(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  // Clean up audio when component unmounts or modal closes
  useEffect(() => {
    return () => {
      if (audioSound) {
        audioSound.unloadAsync();
      }
    };
  }, [audioSound]);

  // Lock orientation to portrait when video modal is open
  useEffect(() => {
    if (videoVisible) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    } else {
      ScreenOrientation.unlockAsync();
    }

    // Clean up on unmount
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, [videoVisible]);

  // Show nothing if modal is not visible
  if (!visible) return null;

  const imageUri = recipe?.imageUrl || recipe?.image;
  const videoUrl = recipe?.videoUrl;
  const audioUrl = recipe?.audioUrl; // Assuming `audioUrl` is part of the recipe object

  // Share handler
  const handleShare = async () => {
    try {
      const message = constructShareMessage(recipe);
      await Share.share({
        message,
      });
    } catch (error) {
      console.error('Error sharing recipe:', error);
    }
  };

  // Construct share message
  const constructShareMessage = (recipe) => {
    let message = `${recipe.title}\n\n`;

    if (recipe.description) {
      message += `${recipe.description}\n\n`;
    }

    if (recipe.ingredients && recipe.ingredients.length > 0) {
      message += 'Ingredients:\n';
      recipe.ingredients.forEach((ingredient) => {
        if (typeof ingredient === 'string') {
          message += `- ${ingredient}\n`;
        } else {
          message += `- ${ingredient.quantity || ''} ${ingredient.unit || ''} ${ingredient.description}\n`;
        }
      });
      message += '\n';
    }

    if (recipe.instructions && recipe.instructions.length > 0) {
      message += 'Instructions:\n';
      recipe.instructions.forEach((instruction, index) => {
        message += `${index + 1}. ${instruction}\n`;
      });
      message += '\n';
    }

    if (recipe.totalNutrition) {
      message += 'Nutrition:\n';
      Object.entries(recipe.totalNutrition).forEach(([key, value]) => {
        message += `${capitalizeFirstLetter(key)}: ${roundToTenth(value)}\n`;
      });
      message += '\n';message += '\n';
    }

    if (recipe.imageUrl) {
      message += `Image: ${recipe.imageUrl}\n\n`;
    }

    if (recipe.videoUrl) {
      message += `Video: ${recipe.videoUrl}\n`;
    }

    return message;
  };

  const handlePlayVideo = () => {
    if (videoUrl) {
      setVideoVisible(true);
    }
  };

  const handleCloseVideo = () => {
    setVideoVisible(false);
    if (videoRef.current) {
      videoRef.current.pauseAsync();
    }
  };

  const handlePlayAudio = async () => {
    if (audioUrl) {
      try {
        setAudioLoading(true);
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          onAudioPlaybackStatusUpdate
        );
        setAudioSound(sound);
        setIsAudioPlaying(true);
      } catch (error) {
        console.error('Error loading audio:', error);
      } finally {
        setAudioLoading(false);
      }
    }
  };

  const handlePauseAudio = async () => {
    if (audioSound) {
      await audioSound.pauseAsync();
      setIsAudioPlaying(false);
    }
  };

  const handleStopAudio = async () => {
    if (audioSound) {
      await audioSound.stopAsync();
      setIsAudioPlaying(false);
    }
  };

  const onAudioPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      if (status.didJustFinish) {
        setIsAudioPlaying(false);
        audioSound.unloadAsync();
        setAudioSound(null);
      }
    } else if (status.error) {
      console.error(`Audio Playback Error: ${status.error}`);
      setIsAudioPlaying(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header with Close and Share Buttons */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessible={true}
              accessibilityLabel="Close Recipe Details"
            >
              <AntDesign name="closecircle" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.recipeTitle}>
              {recipe?.title || 'Recipe Title'}
            </Text>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
              accessible={true}
              accessibilityLabel="Share Recipe"
            >
              <Feather name="share-2" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 30 }}
          >
            {/* Image Section */}
            <View style={styles.imageContainer}>
              <Image
                source={{
                  uri: imageUri || 'https://placehold.co/300x200',
                }}
                style={styles.recipeImage}
              />

              {/* Overlay Play Video Button */}
              {videoUrl && (
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={handlePlayVideo}
                  accessible={true}
                  accessibilityLabel="Play Recipe Video"
                >
                  <Entypo name="controller-play" size={32} color="white" />
                </TouchableOpacity>
              )}

              {/* Overlay Play Audio Button */}
              {audioUrl && (
                <TouchableOpacity
                  style={styles.audioButton}
                  onPress={isAudioPlaying ? handlePauseAudio : handlePlayAudio}
                  accessible={true}
                  accessibilityLabel={
                    isAudioPlaying ? 'Pause Audio' : 'Play Recipe Audio'
                  }
                >
                  {audioLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Feather
                      name={isAudioPlaying ? 'pause-circle' : 'play-circle'}
                      size={32}
                      color="white"
                    />
                  )}
                </TouchableOpacity>
              )}

              {/* Gradient Overlay on the image itself */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.gradientOverlay} // Ensure gradient covers the lower part of the image
              />

              {/* Category | Cuisine | Meal Times Text */}
              <View style={styles.imageTextRow}>
                {recipe?.category && (
                  <Text style={styles.imageText}>{recipe.category}</Text>
                )}
                {recipe?.category && recipe?.cuisine && (
                  <Text style={styles.dividerText}>|</Text>
                )}
                {recipe?.cuisine && (
                  <Text style={styles.imageText}>{recipe.cuisine}</Text>
                )}
                {recipe?.cuisine && recipe?.mealTimes?.length > 0 && (
                  <Text style={styles.dividerText}>|</Text>
                )}
                {recipe?.mealTimes?.length > 0 && (
                  <Text style={styles.imageText}>
                    {recipe.mealTimes.join(', ')}
                  </Text>
                )}
              </View>
            </View>

            {/* Recipe Description */}
            <Text style={styles.recipeText}>
              {recipe?.description || 'Your custom description here...'}
            </Text>

            {/* Attributes */}
            {(recipe?.dietaryPreferences?.length > 0 ||
              recipe?.recipeDescriptions?.length > 0) && (
              <View>
                <Text style={styles.sectionTitle}>Attributes:</Text>
                <View style={styles.attributesContainer}>
                  {recipe?.dietaryPreferences &&
                    recipe.dietaryPreferences.map((preference, index) => (
                      <View key={index} style={styles.attributeTag}>
                        <Text style={styles.tagText}>{preference}</Text>
                      </View>
                    ))}
                  {recipe?.recipeDescriptions &&
                    recipe.recipeDescriptions.map((description, index) => (
                      <View key={index} style={styles.attributeTag}>
                        <Text style={styles.tagText}>{description}</Text>
                      </View>
                    ))}
                </View>
              </View>
            )}

            {/* Ingredients */}
            {recipe?.ingredients && recipe.ingredients.length > 0 ? (
              <View>
                <Text style={styles.sectionTitle}>Ingredients:</Text>
                {recipe.ingredients.map((ingredient, index) => (
                  <View key={index} style={styles.ingredientContainer}>
                    {typeof ingredient === 'string' ? (
                      // Ingredient is a string
                      <Text style={styles.ingredientName}>{ingredient}</Text>
                    ) : (
                      // Ingredient is an object
                      <>
                        <Text style={styles.ingredientName}>
                          {ingredient.description || 'Ingredient'}
                        </Text>
                        <Text style={styles.ingredientDetails}>
                          {ingredient.quantity || ''} {ingredient.unit || ''}
                        </Text>
                      </>
                    )}
                  </View>
                ))}
              </View>
            ) : null}

            {/* Instructions */}
            {recipe?.instructions && recipe.instructions.length > 0 ? (
              <View>
                <Text style={styles.sectionTitle}>Instructions:</Text>
                {recipe.instructions.map((instruction, index) => (
                  <View key={index} style={styles.instructionContainer}>
                    <Text style={styles.instructionText}>
                      {index + 1}. {instruction}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Nutrition Section */}
            {recipe?.totalNutrition ? (
              <View>
                <Text style={styles.sectionTitle}>Nutrition:</Text>
                <View style={styles.nutritionList}>
                  {Object.entries(recipe.totalNutrition).map(([key, value]) => (
                    <View style={styles.nutritionItem} key={key}>
                      <Text style={styles.nutritionText}>
                        {`${capitalizeFirstLetter(key)}: ${roundToTenth(
                          value
                        )}`}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Conditionally render Save button if onSave is provided */}
            {onSave && (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={onSave}
                accessible={true}
                accessibilityLabel="Save Recipe"
              >
                <Text style={styles.saveButtonText}>Save Recipe</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Video Modal */}
          {videoUrl && (
            <Modal
              animationType="slide"
              transparent={false}
              visible={videoVisible}
              onRequestClose={handleCloseVideo}
            >
              <View style={styles.fullScreenVideoModal}>
                <TouchableOpacity
                  style={styles.videoCloseButtonFull}
                  onPress={handleCloseVideo}
                  accessible={true}
                  accessibilityLabel="Close Video"
                >
                  <AntDesign name="closecircle" size={30} color="#fff" />
                </TouchableOpacity>
                <Video
                  ref={videoRef}
                  source={{ uri: videoUrl }}
                  style={styles.fullScreenVideo}
                  useNativeControls
                  resizeMode="cover" // Changed to 'cover' for better scaling in portrait
                  isLooping
                  onLoadStart={() => setVideoLoading(true)}
                  onLoad={() => setVideoLoading(false)}
                />
                {videoLoading && (
                  <ActivityIndicator
                    size="large"
                    color="#fff"
                    style={styles.fullScreenVideoLoader}
                  />
                )}
              </View>
            </Modal>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent background
    justifyContent: 'flex-end', // Align modal to bottom
  },
  modalContent: {
    width: '100%',
    height: '85%',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  dragHandleContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#ccc',
    borderRadius: 2.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  closeButton: {
    padding: 5,
  },
  shareButton: {
    padding: 5,
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
    marginVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  playButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
    zIndex: 3,
  },
  audioButton: {
    position: 'absolute',
    top: 10,
    right: 60, // Position to the left of the video button
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
    zIndex: 3,
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%', // Adjust the height to cover the desired part of the image
    zIndex: 1, // Ensure the gradient is below the text
  },
  imageTextRow: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2, // Place the text above the gradient
  },
  imageText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 5, // Adds spacing between items
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Optional: Add background for better readability
  },
  dividerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 5,
  },
  recipeText: {
    fontSize: 16,
    marginVertical: 10,
  },
  sectionTitle: {
    width: '100%', // Ensures the title spans the full width
    marginBottom: 5, // Provides space between the title and the tags
    fontWeight: 'bold',
    fontSize: 18,
    marginTop: 10,
  },
  attributesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allows the tags to wrap onto the next line if necessary
    paddingHorizontal: 20, // Aligns with the section title for a clean look
    marginTop: 5, // Reduce or remove marginTop to minimize space between title and tags
  },
  attributeTag: {
    backgroundColor: '#27ae60', // Green background for tags (customizable)
    borderRadius: 20, // Rounded edges for the tags
    paddingHorizontal: 12, // Reduce padding to control tag size
    paddingVertical: 6, // Reduce padding for a tighter tag appearance
    margin: 5, // This margin controls space between tags
  },
  tagText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  ingredientContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    paddingBottom: 5,
    borderBottomWidth: 1, // Adds a bottom border
    borderBottomColor: '#ddd', // Light grey color for the border
  },
  ingredientName: {
    fontSize: 16,
    flex: 1,
  },
  ingredientDetails: {
    fontSize: 16,
    flexShrink: 1,
    textAlign: 'right',
  },
  instructionContainer: {
    paddingBottom: 5,
  },
  instructionText: {
    fontSize: 16,
    marginVertical: 5, // Ensures consistent vertical spacing
    paddingLeft: 20, // Adds indentation to the instruction content
  },
  nutritionList: {
    flexDirection: 'row', // Set the main direction to row
    flexWrap: 'wrap', // Allow items to wrap to the next line
    justifyContent: 'space-between', // Distribute space between items
    marginVertical: 5,
  },
  nutritionItem: {
    width: '48%', // Ensures two items per row
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
    alignItems: 'center',
  },
  nutritionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: 'green',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginVertical: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loader: {
    marginTop: 20,
  },
  // Updated Video Modal Styles
  fullScreenVideoModal: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCloseButtonFull: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 2,
  },
  fullScreenVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullScreenVideoLoader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -25,
    marginTop: -25,
  },
});

export default RecipeModal;
