import { useEffect, useRef, useState } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import {
  Box,
  Paper,
  IconButton,
  Slider,
  Stack,
  CircularProgress,
  Alert,
  Typography
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Speed,
  VolumeUp
} from '@mui/icons-material';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';

interface SheetMusicViewerProps {
  xmlUrl?: string;
  midiUrl?: string;
  title?: string;
}

const SheetMusicViewer = ({ xmlUrl, midiUrl, title }: SheetMusicViewerProps): React.ReactNode => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [volume, setVolume] = useState(-12);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const scoreRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const playerRef = useRef<Tone.Player | null>(null);

  // Inicializa OSMD para visualização da partitura
  useEffect(() => {
    if (xmlUrl && scoreRef.current) {
      const osmd = new OpenSheetMusicDisplay(scoreRef.current);
      osmd.setOptions({
        autoResize: true,
        drawTitle: true,
        drawCredits: true
      });
      osmdRef.current = osmd;

      osmd.load(xmlUrl)
        .then(() => {
          osmd.render();
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Erro ao carregar partitura:', err);
          setError('Erro ao carregar a partitura');
          setIsLoading(false);
        });
    }
  }, [xmlUrl]);

  // Inicializa player MIDI
  useEffect(() => {
    if (midiUrl) {
      const player = new Tone.Player(midiUrl, () => {
        setIsLoading(false);
      }).toDestination();
      
      playerRef.current = player;
      
      // Carrega metadata do MIDI
      fetch(midiUrl)
        .then(response => response.arrayBuffer())
        .then(buffer => {
          const midi = new Midi(buffer);
          setDuration(midi.duration);
        })
        .catch(err => {
          console.error('Erro ao carregar MIDI:', err);
          setError('Erro ao carregar o arquivo MIDI');
        });

      return () => {
        player.disconnect();
        player.dispose();
      };
    }
  }, [midiUrl]);

  const handlePlayPause = async () => {
    if (!playerRef.current) return;

    await Tone.start();
    
    if (isPlaying) {
      playerRef.current.stop();
    } else {
      playerRef.current.start();
    }
    
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Paper elevation={3} sx={{ p: 2, minHeight: '400px' }}>
      {isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height="400px">
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Box>
          <Box ref={scoreRef} sx={{ overflowX: 'auto', mb: 2, minHeight: '300px' }} />
          
          {midiUrl && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <IconButton onClick={handlePlayPause} size="large">
                  {isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>
                
                <Box sx={{ flex: 1 }}>
                  <Slider
                    value={playbackTime}
                    min={0}
                    max={duration}
                    onChange={(_event: Event, value: number | number[]) => {
                      if (playerRef.current) {
                        const time = Array.isArray(value) ? value[0] : value;
                        playerRef.current.seek(time);
                        setPlaybackTime(time);
                      }
                    }}
                  />
                  <Typography variant="caption" color="textSecondary">
                    {formatTime(playbackTime)} / {formatTime(duration)}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 200 }}>
                  <Speed />
                  <Slider
                    value={tempo}
                    min={60}
                    max={200}
                    onChange={(_event: Event, value: number | number[]) => {
                      const newTempo = Array.isArray(value) ? value[0] : value;
                      setTempo(newTempo);
                      if (playerRef.current) {
                        playerRef.current.playbackRate = newTempo / 120;
                      }
                    }}
                  />
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 150 }}>
                  <VolumeUp />
                  <Slider
                    value={volume}
                    min={-40}
                    max={0}
                    onChange={(_event: Event, value: number | number[]) => {
                      setVolume(value as number);
                      if (playerRef.current) {
                        playerRef.current.volume.value = value as number;
                      }
                    }}
                  />
                </Stack>
              </Stack>
            </Stack>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default SheetMusicViewer;