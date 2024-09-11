import Head from "next/head";
import { ChangeEvent, useId, useState, useEffect } from "react";
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkedSlider } from "@/components/ui/linkedslider";
import { Textarea } from "@/components/ui/textarea";
import essay from "@/lib/essay";

const DEFAULT_CHUNK_SIZE = 1024;
const DEFAULT_CHUNK_OVERLAP = 20;
const DEFAULT_TOP_K = 2;
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_TOP_P = 1;

export default function Home() {
  const answerId = useId();
  const queryId = useId();
  const sourceId = useId();
  const [text, setText] = useState(essay);
  const [query, setQuery] = useState("");
  const [needsNewIndex, setNeedsNewIndex] = useState(true);
  const [buildingIndex, setBuildingIndex] = useState(false);
  const [runningQuery, setRunningQuery] = useState(false);
  const [nodesWithEmbedding, setNodesWithEmbedding] = useState([]);
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE.toString());
  //^ We're making all of these strings to preserve things like the user typing "0."
  const [chunkOverlap, setChunkOverlap] = useState(
    DEFAULT_CHUNK_OVERLAP.toString(),
  );
  const [topK, setTopK] = useState(DEFAULT_TOP_K.toString());
  const [temperature, setTemperature] = useState(
    DEFAULT_TEMPERATURE.toString(),
  );
  const [topP, setTopP] = useState(DEFAULT_TOP_P.toString());
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Add this state

  useEffect(() => {
    // Set the worker source. This tells PDF.js where to find the worker script, which is necessary for processing PDFs.
    // We're using a CDN to load the worker script. The version is dynamically set based on the version of PDF.js you're using.
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.min.mjs`;
  }, []);

  const handleFileUpload = async (file: File) => {
    setIsLoading(true); // Start loading
    if (file.type === 'application/pdf') {
      console.log("index -> handleFileUpload -> pdf document detected");
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log("index -> handleFileUpload -> pdf document fetched");
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      console.log(`index -> handleFileUpload -> pdf -> fullText fetched for page ${i} / ${pdf.numPages}...`);
      }
      setText(fullText);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        console.log("index -> handleFileUpload -> non-pdf document text fetched");
        setText(content);
      };
      reader.readAsText(file);
    }
    setIsLoading(false); // Stop loading
    setNeedsNewIndex(true);
  };

  return (
    <>
      <Head>
        <title>LlamaIndex.TS Playground</title>
      </Head>
      <main className="mx-2 flex h-full flex-col lg:mx-56">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Upload</h2>
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="w-full sm:w-auto relative">
              <Label htmlFor="file-upload" className="sr-only">
                {isLoading ? "Loading..." : "Choose file"}
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".txt,.md,.pdf"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file);
                  }
                }}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 h-auto py-2"
                disabled={isLoading}
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              )}
            </div>
            <Button
              onClick={() => {
                setText(essay);
                setNeedsNewIndex(true);
              }}
              className="w-full sm:w-auto"
            >
              Reset to Default
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Settings</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <LinkedSlider
                label="Chunk Size:"
                description={
                  "The maximum size of the chunks we are searching over, in tokens. " +
                  "The bigger the chunk, the more likely that the information you are looking " +
                  "for is in the chunk, but also the more likely that the chunk will contain " +
                  "irrelevant information."
                }
                min={1}
                max={3000}
                step={1}
                value={chunkSize}
                onChange={(value: string) => {
                  setChunkSize(value);
                  setNeedsNewIndex(true);
                }}
              />
            </div>
            <div>
              <LinkedSlider
                label="Chunk Overlap:"
                description={
                  "The maximum amount of overlap between chunks, in tokens. " +
                  "Overlap helps ensure that sufficient contextual information is retained."
                }
                min={1}
                max={600}
                step={1}
                value={chunkOverlap}
                onChange={(value: string) => {
                  setChunkOverlap(value);
                  setNeedsNewIndex(true);
                }}
              />
            </div>
          </div>
        </div>
        <div className="my-2 flex h-3/4 flex-auto flex-col space-y-2">
          <Label htmlFor={sourceId}>Source text:</Label>
          <Textarea
            id={sourceId}
            value={text}
            className="flex-1"
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              setText(e.target.value);
              setNeedsNewIndex(true);
            }}
          />
        </div>
        <Button
          disabled={!needsNewIndex || buildingIndex || runningQuery}
          onClick={async () => {
            setAnswer("Building index...");
            setBuildingIndex(true);
            setNeedsNewIndex(false);
            // Post the text and settings to the server
            const result = await fetch("/api/splitandembed", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                document: text,
                chunkSize: parseInt(chunkSize),
                chunkOverlap: parseInt(chunkOverlap),
              }),
            });
            const { error, payload } = await result.json();

            if (error) {
              setAnswer(error);
            }

            if (payload) {
              setNodesWithEmbedding(payload.nodesWithEmbedding);
              setAnswer("Index built!");
            }

            setBuildingIndex(false);
          }}
        >
          {buildingIndex ? "Building Vector index..." : "Build index"}
        </Button>

        {!buildingIndex && !needsNewIndex && !runningQuery && (
          <>
            <h2 className="text-2xl font-bold mt-6 mb-4">Query</h2>
            <div className="my-2 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <LinkedSlider
                label="Top K:"
                description={
                  "The maximum number of chunks to return from the search. " +
                  "It's called Top K because we are retrieving the K nearest neighbors of the query."
                }
                min={1}
                max={15}
                step={1}
                value={topK}
                onChange={(value: string) => {
                  setTopK(value);
                }}
              />

              <LinkedSlider
                label="Temperature:"
                description={
                  "Temperature controls the variability of model response. Adjust it " +
                  "downwards to get more consistent responses, and upwards to get more diversity."
                }
                min={0}
                max={1}
                step={0.01}
                value={temperature}
                onChange={(value: string) => {
                  setTemperature(value);
                }}
              />

              <LinkedSlider
                label="Top P:"
                description={
                  "Top P is another way to control the variability of the model " +
                  "response. It filters out low probability options for the model. It's " +
                  "recommended by OpenAI to set temperature to 1 if you're adjusting " +
                  "the top P."
                }
                min={0}
                max={1}
                step={0.01}
                value={topP}
                onChange={(value: string) => {
                  setTopP(value);
                }}
              />
            </div>

            <div className="my-4">
              <div className="flex w-full items-center space-x-4">
                <Input
                  id={queryId}
                  value={query}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setQuery(e.target.value);
                  }}
                  placeholder="Enter your query here"
                  className="flex-grow max-w-2xl"
                />
                <Button
                  type="submit"
                  disabled={needsNewIndex || buildingIndex || runningQuery}
                  onClick={async () => {
                    setAnswer("Running query...");
                    setRunningQuery(true);
                    // Post the query and nodesWithEmbedding to the server
                    const result = await fetch("/api/retrieveandquery", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        query,
                        nodesWithEmbedding,
                        topK: parseInt(topK),
                        temperature: parseFloat(temperature),
                        topP: parseFloat(topP),
                      }),
                    });

                    const { error, payload } = await result.json();

                    if (error) {
                      setAnswer(error);
                    }

                    if (payload) {
                      setAnswer(payload.response);
                    }

                    setRunningQuery(false);
                  }}
                >
                  Query
                </Button>
              </div>
            </div>
            <div className="my-2 flex h-1/4 flex-auto flex-col space-y-2">
              <Textarea
                className="flex-1"
                readOnly
                value={answer}
                id={answerId}
              />
            </div>
          </>
        )}
      </main>
    </>
  );
}
